import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MembershipStatus,
  Prisma,
  Role,
  SavingsAccountStatus,
  SavingsTransactionType,
} from '@prisma/client';
import * as QRCode from 'qrcode';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AccountingService } from '../accounting/accounting.service';
import { RegulatorAssignmentsService } from '../regulator-assignments/regulator-assignments.service';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { VIEW_SAVINGS_ROLES } from '../cooperatives/roles.constants';
import { CreateSavingsProductDto } from './dto/create-savings-product.dto';
import { UpdateSavingsProductDto } from './dto/update-savings-product.dto';
import { OpenSavingsAccountDto } from './dto/open-savings-account.dto';
import { RecordSavingsTransactionDto } from './dto/record-savings-transaction.dto';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class SavingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly config: ConfigService,
    private readonly accounting: AccountingService,
    private readonly regulatorAssignments: RegulatorAssignmentsService,
  ) {}

  async createProduct(cooperativeId: string, dto: CreateSavingsProductDto) {
    const existing = await this.prisma.savingsProduct.findUnique({
      where: { cooperativeId_code: { cooperativeId, code: dto.code } },
    });
    if (existing) {
      throw new BadRequestException(
        'A savings product with this code already exists',
      );
    }
    return this.prisma.savingsProduct.create({
      data: {
        cooperativeId,
        name: dto.name,
        code: dto.code,
        interestRatePercent: dto.interestRatePercent ?? 0,
        minimumBalance: dto.minimumBalance ?? 0,
        isActive: dto.isActive ?? true,
      },
    });
  }

  async listProducts(cooperativeId: string, user: AuthenticatedUser) {
    await this.assertMember(cooperativeId, user);
    return this.prisma.savingsProduct.findMany({
      where: { cooperativeId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async updateProduct(
    cooperativeId: string,
    productId: string,
    dto: UpdateSavingsProductDto,
  ) {
    const product = await this.getProductOrThrow(cooperativeId, productId);
    return this.prisma.savingsProduct.update({
      where: { id: product.id },
      data: dto,
    });
  }

  async openAccount(
    cooperativeId: string,
    userId: string,
    actor: AuthenticatedUser,
    dto: OpenSavingsAccountDto,
  ) {
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new BadRequestException('User is not an active cooperative member');
    }

    const product = await this.getProductOrThrow(cooperativeId, dto.productId);
    if (!product.isActive) {
      throw new BadRequestException('This savings product is not active');
    }

    const existing = await this.prisma.savingsAccount.findFirst({
      where: { membershipId: membership.id, productId: product.id },
    });
    if (existing) {
      throw new BadRequestException(
        'This member already has an account for this product',
      );
    }

    const accountNumber = await this.generateAccountNumber(cooperativeId);
    const account = await this.prisma.savingsAccount.create({
      data: {
        cooperativeId,
        membershipId: membership.id,
        productId: product.id,
        accountNumber,
      },
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'savings.account_opened',
      targetType: 'SavingsAccount',
      targetId: account.id,
      metadata: { userId, productId: product.id },
    });

    return account;
  }

  async listAccountsForMember(
    cooperativeId: string,
    userId: string,
    requester: AuthenticatedUser,
  ) {
    await this.assertSelfOrViewRole(cooperativeId, userId, requester);
    return this.prisma.savingsAccount.findMany({
      where: { cooperativeId, membership: { userId } },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async listAccountsForCooperative(cooperativeId: string) {
    return this.prisma.savingsAccount.findMany({
      where: { cooperativeId },
      include: {
        product: true,
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
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async recordTransaction(
    cooperativeId: string,
    accountId: string,
    actor: AuthenticatedUser,
    dto: RecordSavingsTransactionDto,
  ) {
    const account = await this.getAccountOrThrow(cooperativeId, accountId);
    if (account.status !== SavingsAccountStatus.ACTIVE) {
      throw new BadRequestException('This savings account is not active');
    }

    const amount = new Prisma.Decimal(dto.amount);
    const balanceAfter =
      dto.type === 'DEPOSIT'
        ? account.balance.plus(amount)
        : account.balance.minus(amount);

    if (
      dto.type === 'WITHDRAWAL' &&
      balanceAfter.lessThan(account.product.minimumBalance)
    ) {
      throw new BadRequestException(
        'This withdrawal would breach the product minimum balance',
      );
    }

    const [, transaction] = await this.prisma.$transaction([
      this.prisma.savingsAccount.update({
        where: { id: account.id },
        data: { balance: balanceAfter },
      }),
      this.prisma.savingsTransaction.create({
        data: {
          accountId: account.id,
          type:
            dto.type === 'DEPOSIT'
              ? SavingsTransactionType.DEPOSIT
              : SavingsTransactionType.WITHDRAWAL,
          amount,
          balanceAfter,
          narration: dto.narration,
          recordedByUserId: actor.userId,
        },
      }),
    ]);

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'savings.transaction_recorded',
      targetType: 'SavingsTransaction',
      targetId: transaction.id,
      metadata: { accountId: account.id, type: dto.type, amount: dto.amount },
    });

    if (dto.type === 'DEPOSIT') {
      await this.accounting.postSavingsDeposit(
        cooperativeId,
        dto.amount,
        transaction.id,
      );
    } else {
      await this.accounting.postSavingsWithdrawal(
        cooperativeId,
        dto.amount,
        transaction.id,
      );
    }

    return transaction;
  }

  async accrueInterest(
    cooperativeId: string,
    accountId: string,
    actor: AuthenticatedUser,
  ) {
    const account = await this.getAccountOrThrow(cooperativeId, accountId);
    if (account.status !== SavingsAccountStatus.ACTIVE) {
      throw new BadRequestException('This savings account is not active');
    }

    const since = account.lastInterestAccrualAt ?? account.openedAt;
    const days = Math.floor((Date.now() - since.getTime()) / MS_PER_DAY);
    if (days < 1) {
      throw new BadRequestException('No interest is due yet');
    }

    const rate = account.product.interestRatePercent.dividedBy(100);
    const interest = account.balance
      .times(rate)
      .times(days)
      .dividedBy(365)
      .toDecimalPlaces(2);

    if (interest.lessThanOrEqualTo(0)) {
      throw new BadRequestException('No interest is due yet');
    }

    const balanceAfter = account.balance.plus(interest);
    const now = new Date();

    const [, transaction] = await this.prisma.$transaction([
      this.prisma.savingsAccount.update({
        where: { id: account.id },
        data: { balance: balanceAfter, lastInterestAccrualAt: now },
      }),
      this.prisma.savingsTransaction.create({
        data: {
          accountId: account.id,
          type: SavingsTransactionType.INTEREST,
          amount: interest,
          balanceAfter,
          narration: `Interest for ${days} day(s)`,
          recordedByUserId: actor.userId,
        },
      }),
    ]);

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'savings.interest_accrued',
      targetType: 'SavingsTransaction',
      targetId: transaction.id,
      metadata: { accountId: account.id, days, interest: interest.toString() },
    });

    await this.accounting.postSavingsInterest(
      cooperativeId,
      interest.toNumber(),
      transaction.id,
    );

    return transaction;
  }

  async listTransactions(
    cooperativeId: string,
    accountId: string,
    requester: AuthenticatedUser,
  ) {
    const account = await this.getAccountOrThrow(cooperativeId, accountId);
    await this.assertSelfOrViewRole(
      cooperativeId,
      account.membership.userId,
      requester,
    );
    return this.prisma.savingsTransaction.findMany({
      where: { accountId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getReceipt(
    cooperativeId: string,
    accountId: string,
    transactionId: string,
    requester: AuthenticatedUser,
  ) {
    const account = await this.getAccountOrThrow(cooperativeId, accountId);
    await this.assertSelfOrViewRole(
      cooperativeId,
      account.membership.userId,
      requester,
    );

    const transaction = await this.prisma.savingsTransaction.findUnique({
      where: { id: transactionId },
    });
    if (!transaction || transaction.accountId !== accountId) {
      throw new NotFoundException('Transaction not found');
    }

    const appUrl =
      this.config.get<string>('APP_URL') ?? 'http://localhost:3000';
    const verifyUrl = `${appUrl}/verify-receipt?account=${accountId}&transaction=${transactionId}`;
    const qrCodeDataUrl = await QRCode.toDataURL(verifyUrl);

    return {
      transactionId: transaction.id,
      type: transaction.type,
      amount: transaction.amount,
      balanceAfter: transaction.balanceAfter,
      narration: transaction.narration,
      createdAt: transaction.createdAt,
      account: {
        accountNumber: account.accountNumber,
        product: account.product.name,
      },
      member: {
        firstName: account.membership.user.firstName,
        lastName: account.membership.user.lastName,
        email: account.membership.user.email,
      },
      qrCodeDataUrl,
    };
  }

  private async getProductOrThrow(cooperativeId: string, productId: string) {
    const product = await this.prisma.savingsProduct.findUnique({
      where: { id: productId },
    });
    if (!product || product.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Savings product not found');
    }
    return product;
  }

  private async getAccountOrThrow(cooperativeId: string, accountId: string) {
    const account = await this.prisma.savingsAccount.findUnique({
      where: { id: accountId },
      include: {
        product: true,
        membership: { include: { user: true } },
      },
    });
    if (!account || account.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Savings account not found');
    }
    return account;
  }

  private async generateAccountNumber(cooperativeId: string): Promise<string> {
    const cooperative = await this.prisma.cooperative.findUniqueOrThrow({
      where: { id: cooperativeId },
    });
    const count = await this.prisma.savingsAccount.count({
      where: { cooperativeId },
    });
    const prefix = cooperative.slug.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return `${prefix}-SAV-${String(count + 1).padStart(4, '0')}`;
  }

  private async assertMember(cooperativeId: string, user: AuthenticatedUser) {
    if (user.role === Role.SUPER_ADMIN) {
      return;
    }
    if (user.role === Role.REGULATOR) {
      const assigned = await this.regulatorAssignments.isAssigned(
        user.userId,
        cooperativeId,
      );
      if (!assigned) {
        throw new ForbiddenException(
          'You are not assigned to this cooperative',
        );
      }
      return;
    }
    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: user.userId } },
    });
    if (!membership || membership.status !== MembershipStatus.ACTIVE) {
      throw new ForbiddenException('You are not a member of this cooperative');
    }
  }

  private async assertSelfOrViewRole(
    cooperativeId: string,
    targetUserId: string,
    requester: AuthenticatedUser,
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
    const canView =
      !!requesterMembership &&
      requesterMembership.status === MembershipStatus.ACTIVE &&
      (VIEW_SAVINGS_ROLES as readonly Role[]).includes(
        requesterMembership.role,
      );
    if (!canView) {
      throw new ForbiddenException(
        "You do not have permission to view this member's savings",
      );
    }
  }
}
