import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import {
  DocumentCategory,
  LoanLedgerEntryType,
  LoanStatus,
  MeetingStatus,
  MembershipStatus,
  NotificationChannel,
  PaymentStatus,
  Prisma,
  ResolutionStatus,
  Role,
  SavingsAccountStatus,
  SavingsTransactionType,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { PdfService } from '../pdf/pdf.service';
import { NotificationsService } from '../notifications/notifications.service';
import { AccountingService } from '../accounting/accounting.service';
import { AiService } from '../ai/ai.service';
import { toCsv } from './csv.util';

const DOCUMENT_METADATA_SELECT = {
  id: true,
  cooperativeId: true,
  uploadedByUserId: true,
  title: true,
  category: true,
  fileName: true,
  mimeType: true,
  sizeBytes: true,
  createdAt: true,
};

function monthRange(monthsAgo: number, from: Date) {
  const start = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - monthsAgo, 1),
  );
  const end = new Date(
    Date.UTC(from.getUTCFullYear(), from.getUTCMonth() - monthsAgo + 1, 1),
  );
  const label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
  return { start, end, label };
}

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly pdf: PdfService,
    private readonly notifications: NotificationsService,
    private readonly accounting: AccountingService,
    private readonly ai: AiService,
  ) {}

  async computeDashboard(cooperativeId: string) {
    await this.getCooperativeOrThrow(cooperativeId);
    const now = new Date();
    const monthStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1),
    );
    const monthEnd = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
    );

    const [
      activeMembers,
      pendingApplications,
      savingsAgg,
      loansAgg,
      disbursedAgg,
      paymentsAgg,
      upcomingMeetings,
      openResolutions,
      trialBalance,
      incomeStatement,
    ] = await Promise.all([
      this.prisma.cooperativeMembership.count({
        where: { cooperativeId, status: MembershipStatus.ACTIVE },
      }),
      this.prisma.cooperativeMembership.count({
        where: { cooperativeId, status: MembershipStatus.PENDING },
      }),
      this.prisma.savingsAccount.aggregate({
        where: { cooperativeId, status: SavingsAccountStatus.ACTIVE },
        _sum: { balance: true },
      }),
      this.prisma.loan.aggregate({
        where: { cooperativeId, status: LoanStatus.ACTIVE },
        _sum: { outstandingBalance: true },
      }),
      this.prisma.loanLedgerEntry.aggregate({
        where: {
          type: LoanLedgerEntryType.DISBURSEMENT,
          createdAt: { gte: monthStart, lt: monthEnd },
          loan: { cooperativeId },
        },
        _sum: { amount: true },
      }),
      this.prisma.payment.aggregate({
        where: {
          cooperativeId,
          status: PaymentStatus.SUCCESS,
          completedAt: { gte: monthStart, lt: monthEnd },
        },
        _sum: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.meeting.count({
        where: {
          cooperativeId,
          status: MeetingStatus.SCHEDULED,
          scheduledAt: { gt: now },
        },
      }),
      this.prisma.resolution.count({
        where: {
          status: ResolutionStatus.PROPOSED,
          meeting: { cooperativeId },
        },
      }),
      this.accounting.getTrialBalance(cooperativeId),
      this.accounting.getIncomeStatement(cooperativeId),
    ]);

    const cashRow = trialBalance.find((r) => r.account.code === '1000');
    const cashBalance = cashRow ? cashRow.balance : new Prisma.Decimal(0);

    return {
      activeMembers,
      pendingApplications,
      totalSavingsBalance: (
        savingsAgg._sum.balance ?? new Prisma.Decimal(0)
      ).toFixed(2),
      totalOutstandingLoans: (
        loansAgg._sum.outstandingBalance ?? new Prisma.Decimal(0)
      ).toFixed(2),
      loansDisbursedThisMonth: (
        disbursedAgg._sum.amount ?? new Prisma.Decimal(0)
      ).toFixed(2),
      paymentsThisMonthCount: paymentsAgg._count._all,
      paymentsThisMonthTotal: (
        paymentsAgg._sum.amount ?? new Prisma.Decimal(0)
      ).toFixed(2),
      upcomingMeetings,
      openResolutions,
      cashBalance: cashBalance.toFixed(2),
      totalIncome: incomeStatement.totalIncome.toFixed(2),
      totalExpense: incomeStatement.totalExpense.toFixed(2),
      netSurplus: incomeStatement.netSurplus.toFixed(2),
      generatedAt: now.toISOString(),
    };
  }

  async computeTrends(cooperativeId: string, months: number) {
    await this.getCooperativeOrThrow(cooperativeId);
    const now = new Date();
    const clampedMonths = Math.min(Math.max(months, 1), 24);
    const series: {
      month: string;
      newMembers: number;
      savingsNet: string;
      loanDisbursed: string;
      loanRepaid: string;
    }[] = [];

    for (let i = clampedMonths - 1; i >= 0; i--) {
      const { start, end, label } = monthRange(i, now);
      const [newMembers, deposits, withdrawals, disbursed, repaid] =
        await Promise.all([
          this.prisma.cooperativeMembership.count({
            where: { cooperativeId, joinedAt: { gte: start, lt: end } },
          }),
          this.prisma.savingsTransaction.aggregate({
            where: {
              type: SavingsTransactionType.DEPOSIT,
              createdAt: { gte: start, lt: end },
              account: { cooperativeId },
            },
            _sum: { amount: true },
          }),
          this.prisma.savingsTransaction.aggregate({
            where: {
              type: SavingsTransactionType.WITHDRAWAL,
              createdAt: { gte: start, lt: end },
              account: { cooperativeId },
            },
            _sum: { amount: true },
          }),
          this.prisma.loanLedgerEntry.aggregate({
            where: {
              type: LoanLedgerEntryType.DISBURSEMENT,
              createdAt: { gte: start, lt: end },
              loan: { cooperativeId },
            },
            _sum: { amount: true },
          }),
          this.prisma.loanLedgerEntry.aggregate({
            where: {
              type: LoanLedgerEntryType.REPAYMENT,
              createdAt: { gte: start, lt: end },
              loan: { cooperativeId },
            },
            _sum: { amount: true },
          }),
        ]);

      const savingsNet = new Prisma.Decimal(deposits._sum.amount ?? 0).minus(
        withdrawals._sum.amount ?? 0,
      );

      series.push({
        month: label,
        newMembers,
        savingsNet: savingsNet.toFixed(2),
        loanDisbursed: (disbursed._sum.amount ?? new Prisma.Decimal(0)).toFixed(
          2,
        ),
        loanRepaid: (repaid._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
      });
    }

    return series;
  }

  async exportMembersCsv(cooperativeId: string) {
    const memberships = await this.prisma.cooperativeMembership.findMany({
      where: { cooperativeId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });
    const rows = memberships.map((m) => ({
      membershipNumber: m.membershipNumber ?? '',
      firstName: m.user.firstName,
      lastName: m.user.lastName,
      email: m.user.email,
      role: m.role,
      status: m.status,
      category: m.category,
      joinedAt: m.joinedAt.toISOString(),
    }));
    return toCsv(rows, [
      'membershipNumber',
      'firstName',
      'lastName',
      'email',
      'role',
      'status',
      'category',
      'joinedAt',
    ]);
  }

  async exportSavingsTransactionsCsv(cooperativeId: string) {
    const transactions = await this.prisma.savingsTransaction.findMany({
      where: { account: { cooperativeId } },
      include: {
        account: {
          select: {
            accountNumber: true,
            membership: {
              select: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const rows = transactions.map((t) => ({
      accountNumber: t.account.accountNumber,
      member: `${t.account.membership.user.firstName} ${t.account.membership.user.lastName}`,
      type: t.type,
      amount: t.amount.toFixed(2),
      balanceAfter: t.balanceAfter.toFixed(2),
      narration: t.narration ?? '',
      createdAt: t.createdAt.toISOString(),
    }));
    return toCsv(rows, [
      'accountNumber',
      'member',
      'type',
      'amount',
      'balanceAfter',
      'narration',
      'createdAt',
    ]);
  }

  async exportLoansCsv(cooperativeId: string) {
    const loans = await this.prisma.loan.findMany({
      where: { cooperativeId },
      include: {
        product: { select: { name: true } },
        membership: {
          select: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    const rows = loans.map((l) => ({
      member: `${l.membership.user.firstName} ${l.membership.user.lastName}`,
      product: l.product.name,
      principal: l.principal.toFixed(2),
      interestRatePercent: l.interestRatePercent.toFixed(2),
      termMonths: l.termMonths,
      status: l.status,
      outstandingBalance: l.outstandingBalance.toFixed(2),
      createdAt: l.createdAt.toISOString(),
    }));
    return toCsv(rows, [
      'member',
      'product',
      'principal',
      'interestRatePercent',
      'termMonths',
      'status',
      'outstandingBalance',
      'createdAt',
    ]);
  }

  async exportJournalEntriesCsv(cooperativeId: string) {
    const entries = await this.prisma.journalEntry.findMany({
      where: { cooperativeId },
      include: {
        lines: { include: { account: { select: { code: true, name: true } } } },
      },
      orderBy: { date: 'asc' },
    });
    const rows: Record<string, string | number | undefined>[] = [];
    for (const entry of entries) {
      for (const line of entry.lines) {
        rows.push({
          date: entry.date.toISOString(),
          memo: entry.memo ?? '',
          source: entry.source,
          accountCode: line.account.code,
          accountName: line.account.name,
          debit: line.debit.toFixed(2),
          credit: line.credit.toFixed(2),
        });
      }
    }
    return toCsv(rows, [
      'date',
      'memo',
      'source',
      'accountCode',
      'accountName',
      'debit',
      'credit',
    ]);
  }

  async generateMonthlyDigest(cooperativeId: string, actorUserId?: string) {
    const cooperative = await this.getCooperativeOrThrow(cooperativeId);
    const dashboard = await this.computeDashboard(cooperativeId);
    const period = new Date().toISOString().slice(0, 7);

    const uploaderId =
      actorUserId ?? (await this.findFallbackAdminUserId(cooperativeId));
    if (!uploaderId) {
      throw new NotFoundException(
        'No cooperative administrator found to attribute this report to',
      );
    }

    let narrative: string | undefined;
    try {
      narrative = await this.ai.generateReportNarrative(
        cooperative.name,
        period,
        dashboard,
      );
    } catch (err) {
      this.logger.warn(
        `AI narrative unavailable for cooperative ${cooperativeId}'s ${period} report: ${
          err instanceof Error ? err.message : String(err)
        }`,
      );
    }

    const pdf = await this.pdf.generateDashboardReportPdf({
      cooperativeName: cooperative.name,
      period,
      summary: dashboard,
      narrative,
    });

    const document = await this.prisma.document.create({
      data: {
        cooperativeId,
        uploadedByUserId: uploaderId,
        title: `Monthly Report — ${period}`,
        category: DocumentCategory.REPORT,
        fileName: `monthly-report-${period}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: pdf.length,
        content: pdf,
      },
      select: DOCUMENT_METADATA_SELECT,
    });

    const activeMembers = await this.prisma.cooperativeMembership.findMany({
      where: { cooperativeId, status: MembershipStatus.ACTIVE },
      select: { userId: true },
    });
    await Promise.all(
      activeMembers.map((m) =>
        this.notifications.send({
          cooperativeId,
          recipientUserId: m.userId,
          channel: NotificationChannel.EMAIL,
          subject: `Monthly report ready: ${period}`,
          body: `The ${period} report for ${cooperative.name} is ready. Find "${document.title}" under Documents.`,
          sentByUserId: uploaderId,
        }),
      ),
    );

    await this.auditLog.record({
      cooperativeId,
      actorUserId: uploaderId,
      action: 'report.generated',
      targetType: 'Document',
      targetId: document.id,
      metadata: { period },
    });

    return document;
  }

  @Cron(CronExpression.EVERY_1ST_DAY_OF_MONTH_AT_MIDNIGHT)
  async runScheduledMonthlyDigests() {
    const cooperatives = await this.prisma.cooperative.findMany({
      where: { isActive: true },
      select: { id: true },
    });
    for (const cooperative of cooperatives) {
      try {
        await this.generateMonthlyDigest(cooperative.id);
      } catch (err) {
        this.logger.error(
          `Failed to generate monthly digest for cooperative ${cooperative.id}`,
          err instanceof Error ? err.stack : String(err),
        );
      }
    }
  }

  private async findFallbackAdminUserId(
    cooperativeId: string,
  ): Promise<string | null> {
    const admin = await this.prisma.cooperativeMembership.findFirst({
      where: {
        cooperativeId,
        status: MembershipStatus.ACTIVE,
        role: Role.COOPERATIVE_ADMIN,
      },
      select: { userId: true },
    });
    return admin?.userId ?? null;
  }

  private async getCooperativeOrThrow(cooperativeId: string) {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
    });
    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }
    return cooperative;
  }
}
