import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
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
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  MANAGE_PAYMENT_ROLES,
  VIEW_PAYMENT_ROLES,
} from '../cooperatives/roles.constants';
import { InitiatePaymentDto } from './dto/initiate-payment.dto';
import { SimulateCallbackDto } from './dto/simulate-callback.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly savings: SavingsService,
    private readonly loans: LoansService,
  ) {}

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

    const gatewayReference = `SIM-${randomBytes(6).toString('hex').toUpperCase()}`;

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
        gatewayReference,
        narration: dto.narration,
      },
    });
  }

  async simulateCallback(
    cooperativeId: string,
    paymentId: string,
    requester: AuthenticatedUser,
    dto: SimulateCallbackDto,
  ) {
    const payment = await this.getPaymentOrThrow(cooperativeId, paymentId);
    await this.assertSelfOrRole(
      cooperativeId,
      payment.membership.userId,
      requester,
      MANAGE_PAYMENT_ROLES,
    );
    if (payment.status !== PaymentStatus.INITIATED) {
      throw new BadRequestException('This payment has already been completed');
    }

    if (dto.outcome === 'FAILED') {
      return this.prisma.payment.update({
        where: { id: paymentId },
        data: { status: PaymentStatus.FAILED, completedAt: new Date() },
      });
    }

    const payerActor: AuthenticatedUser = {
      userId: payment.membership.userId,
      email: payment.membership.user.email,
      role: payment.membership.user.role,
    };
    const narration = `Gateway payment ${payment.gatewayReference}`;

    if (payment.purpose === PaymentPurpose.SAVINGS_DEPOSIT) {
      await this.savings.recordTransaction(
        cooperativeId,
        payment.savingsAccountId!,
        payerActor,
        { type: 'DEPOSIT', amount: Number(payment.amount), narration },
      );
    } else {
      await this.loans.recordRepayment(
        cooperativeId,
        payment.loanId!,
        payerActor,
        {
          amount: Number(payment.amount),
          narration,
        },
      );
    }

    return this.prisma.payment.update({
      where: { id: paymentId },
      data: { status: PaymentStatus.SUCCESS, completedAt: new Date() },
    });
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
      include: {
        membership: { include: { user: true } },
        savingsAccount: { include: { product: true } },
        loan: { include: { product: true } },
      },
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
