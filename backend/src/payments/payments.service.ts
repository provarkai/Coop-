import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MembershipStatus,
  PaymentPurpose,
  PaymentStatus,
  Role,
  SavingsAccountStatus,
  LoanStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SavingsService } from '../savings/savings.service';
import { LoansService } from '../loans/loans.service';
import { PaystackService } from './paystack.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { VIEW_PAYMENT_ROLES } from '../cooperatives/roles.constants';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { ConnectBankAccountDto } from './dto/connect-bank-account.dto';

const PAYMENT_INCLUDE = {
  membership: { include: { user: true } },
  savingsAccount: { include: { product: true } },
  loan: { include: { product: true } },
} as const;

const BANK_ACCOUNT_SELECT = {
  paystackSubaccountCode: true,
  paystackSubaccountBankCode: true,
  paystackSubaccountAccountNumber: true,
  paystackSubaccountAccountName: true,
} as const;

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly savings: SavingsService,
    private readonly loans: LoansService,
    private readonly paystack: PaystackService,
    private readonly config: ConfigService,
  ) {}

  async listBanks() {
    return this.paystack.listBanks();
  }

  async connectBankAccount(cooperativeId: string, dto: ConnectBankAccountDto) {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
    });
    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }
    const resolved = await this.paystack.resolveAccountNumber(
      dto.accountNumber,
      dto.bankCode,
    );
    const subaccount = await this.paystack.createSubaccount({
      businessName: cooperative.name,
      bankCode: dto.bankCode,
      accountNumber: dto.accountNumber,
    });
    return this.prisma.cooperative.update({
      where: { id: cooperativeId },
      data: {
        paystackSubaccountCode: subaccount.subaccountCode,
        paystackSubaccountBankCode: dto.bankCode,
        paystackSubaccountAccountNumber: resolved.accountNumber,
        paystackSubaccountAccountName: resolved.accountName,
      },
      select: BANK_ACCOUNT_SELECT,
    });
  }

  async getBankAccountStatus(cooperativeId: string) {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
      select: BANK_ACCOUNT_SELECT,
    });
    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }
    return { ...cooperative, connected: !!cooperative.paystackSubaccountCode };
  }

  async initiate(
    cooperativeId: string,
    payer: AuthenticatedUser,
    dto: InitiatePaymentDto,
  ) {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: payer.userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new BadRequestException('You are not an active cooperative member');
    }

    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
    });
    if (!cooperative?.paystackSubaccountCode) {
      throw new BadRequestException(
        'This cooperative has not connected a bank account yet -- ask your cooperative admin to set one up in Settings before paying.',
      );
    }

    let savingsAccountId: string | undefined;
    let loanId: string | undefined;

    if (dto.purpose === 'SAVINGS_DEPOSIT') {
      const account = await this.prisma.savingsAccount.findUnique({
        where: { id: dto.targetId },
      });
      if (
        !account ||
        account.cooperativeId !== cooperativeId ||
        account.membershipId !== membership.id
      ) {
        throw new NotFoundException('Savings account not found');
      }
      if (account.status !== SavingsAccountStatus.ACTIVE) {
        throw new BadRequestException('This savings account is not active');
      }
      savingsAccountId = account.id;
    } else {
      const loan = await this.prisma.loan.findUnique({
        where: { id: dto.targetId },
      });
      if (
        !loan ||
        loan.cooperativeId !== cooperativeId ||
        loan.membershipId !== membership.id
      ) {
        throw new NotFoundException('Loan not found');
      }
      if (loan.status !== LoanStatus.ACTIVE) {
        throw new BadRequestException('This loan is not active');
      }
      loanId = loan.id;
    }

    const gatewayReference = `NCMS-${randomBytes(6).toString('hex').toUpperCase()}`;
    const frontendUrl =
      this.config.get<string>('FRONTEND_URL') ?? 'http://localhost:3000';
    const initialized = await this.paystack.initializeTransaction({
      email: payer.email,
      amountNaira: dto.amount,
      reference: gatewayReference,
      subaccountCode: cooperative.paystackSubaccountCode,
      callbackUrl: `${frontendUrl}/payments/callback?cooperativeId=${cooperativeId}`,
    });

    return this.prisma.payment.create({
      data: {
        cooperativeId,
        membershipId: membership.id,
        purpose:
          dto.purpose === 'SAVINGS_DEPOSIT'
            ? PaymentPurpose.SAVINGS_DEPOSIT
            : PaymentPurpose.LOAN_REPAYMENT,
        savingsAccountId,
        loanId,
        amount: dto.amount,
        gatewayReference: initialized.reference,
        authorizationUrl: initialized.authorizationUrl,
        narration: dto.narration,
      },
    });
  }

  /** Called by the frontend's /payments/callback return page as a belt-and-braces
   * check in case the webhook hasn't landed yet -- forces a live Paystack verify. */
  async verifyAndSync(
    cooperativeId: string,
    paymentId: string,
    requester: AuthenticatedUser,
  ) {
    const payment = await this.getPaymentOrThrow(cooperativeId, paymentId);
    return this.verifyPaymentRecord(payment, requester);
  }

  /** Same as verifyAndSync, but keyed by the Paystack reference -- the
   * checkout-return page only has the reference Paystack appended to the
   * callback URL, not our internal payment id. */
  async verifyByReference(
    cooperativeId: string,
    reference: string,
    requester: AuthenticatedUser,
  ) {
    const payment = await this.prisma.payment.findUnique({
      where: { gatewayReference: reference },
      include: PAYMENT_INCLUDE,
    });
    if (!payment || payment.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Payment not found');
    }
    return this.verifyPaymentRecord(payment, requester);
  }

  private async verifyPaymentRecord(
    payment: Awaited<ReturnType<PaymentsService['getPaymentOrThrow']>>,
    requester: AuthenticatedUser,
  ) {
    await this.assertSelfOrRole(
      payment.cooperativeId,
      payment.membership.userId,
      requester,
      VIEW_PAYMENT_ROLES,
    );
    if (payment.status !== PaymentStatus.INITIATED) {
      return payment;
    }
    const verified = await this.paystack.verifyTransaction(
      payment.gatewayReference,
    );
    if (verified.status === 'success') {
      return this.applySuccess(payment);
    }
    if (verified.status === 'failed' || verified.status === 'abandoned') {
      return this.applyFailed(payment);
    }
    return payment;
  }

  async handleWebhookEvent(rawBody: Buffer, signature: string | undefined) {
    if (!this.paystack.verifyWebhookSignature(rawBody, signature)) {
      throw new ForbiddenException('Invalid webhook signature');
    }
    const event = JSON.parse(rawBody.toString('utf8')) as {
      event?: string;
      data?: { reference?: string };
    };
    const reference = event.data?.reference;
    if (!reference) {
      return { received: true };
    }
    const payment = await this.prisma.payment.findUnique({
      where: { gatewayReference: reference },
      include: PAYMENT_INCLUDE,
    });
    if (!payment) {
      this.logger.warn(`Webhook for unknown payment reference ${reference}`);
      return { received: true };
    }
    if (event.event === 'charge.success') {
      await this.applySuccess(payment);
    } else if (event.event === 'charge.failed') {
      await this.applyFailed(payment);
    }
    return { received: true };
  }

  /** Atomically claims the payment (INITIATED -> SUCCESS) before crediting the
   * ledger, so a retried webhook racing a manual verify can never double-credit.
   * If crediting then fails, the claim is rolled back to INITIATED so a later
   * retry can safely try again. */
  private async applySuccess(
    payment: Awaited<ReturnType<PaymentsService['getPaymentOrThrow']>>,
  ) {
    const claimed = await this.prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.INITIATED },
      data: { status: PaymentStatus.SUCCESS, completedAt: new Date() },
    });
    if (claimed.count === 0) {
      return this.getPaymentOrThrow(payment.cooperativeId, payment.id);
    }

    const payerActor: AuthenticatedUser = {
      userId: payment.membership.userId,
      email: payment.membership.user.email,
      role: payment.membership.user.role,
    };
    const narration = `Paystack payment ${payment.gatewayReference}`;
    try {
      if (payment.purpose === PaymentPurpose.SAVINGS_DEPOSIT) {
        await this.savings.recordTransaction(
          payment.cooperativeId,
          payment.savingsAccountId!,
          payerActor,
          { type: 'DEPOSIT', amount: Number(payment.amount), narration },
        );
      } else {
        await this.loans.recordRepayment(
          payment.cooperativeId,
          payment.loanId!,
          payerActor,
          { amount: Number(payment.amount), narration },
        );
      }
    } catch (err) {
      this.logger.error(
        `Failed to credit ledger for payment ${payment.id} after Paystack success: ${err}`,
      );
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.INITIATED, completedAt: null },
      });
      throw err;
    }
    return this.getPaymentOrThrow(payment.cooperativeId, payment.id);
  }

  private async applyFailed(
    payment: Awaited<ReturnType<PaymentsService['getPaymentOrThrow']>>,
  ) {
    await this.prisma.payment.updateMany({
      where: { id: payment.id, status: PaymentStatus.INITIATED },
      data: { status: PaymentStatus.FAILED, completedAt: new Date() },
    });
    return this.getPaymentOrThrow(payment.cooperativeId, payment.id);
  }

  async listForCooperative(cooperativeId: string, status?: PaymentStatus) {
    return this.prisma.payment.findMany({
      where: { cooperativeId, status },
      include: {
        membership: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
        savingsAccount: { include: { product: true } },
        loan: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async listForMember(
    cooperativeId: string,
    userId: string,
    requester: AuthenticatedUser,
  ) {
    await this.assertSelfOrRole(
      cooperativeId,
      userId,
      requester,
      VIEW_PAYMENT_ROLES,
    );
    return this.prisma.payment.findMany({
      where: { cooperativeId, membership: { userId } },
      include: {
        savingsAccount: { include: { product: true } },
        loan: { include: { product: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getPayment(
    cooperativeId: string,
    paymentId: string,
    requester: AuthenticatedUser,
  ) {
    const payment = await this.getPaymentOrThrow(cooperativeId, paymentId);
    await this.assertSelfOrRole(
      cooperativeId,
      payment.membership.userId,
      requester,
      VIEW_PAYMENT_ROLES,
    );
    return payment;
  }

  private async getPaymentOrThrow(cooperativeId: string, paymentId: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id: paymentId },
      include: PAYMENT_INCLUDE,
    });
    if (!payment || payment.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Payment not found');
    }
    return payment;
  }

  private async assertSelfOrRole(
    cooperativeId: string,
    targetUserId: string,
    requester: AuthenticatedUser,
    allowedRoles: readonly Role[],
  ) {
    if (
      requester.userId === targetUserId ||
      requester.role === Role.SUPER_ADMIN
    ) {
      return;
    }
    const requesterMembership =
      await this.prisma.cooperativeMembership.findUnique({
        where: {
          cooperativeId_userId: { cooperativeId, userId: requester.userId },
        },
      });
    const canAccess =
      !!requesterMembership &&
      requesterMembership.status === MembershipStatus.ACTIVE &&
      allowedRoles.includes(requesterMembership.role);
    if (!canAccess) {
      throw new ForbiddenException(
        "You do not have permission to access this member's payments",
      );
    }
  }
}
