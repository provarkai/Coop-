import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentCategory,
  LoanLedgerEntryType,
  LoanStatus,
  MeetingStatus,
  MembershipStatus,
  PaymentStatus,
  Prisma,
  RepaymentInstallmentStatus,
  ResolutionStatus,
  Role,
  SavingsAccountStatus,
  VoteChoice,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { AccountingService } from '../accounting/accounting.service';
import { RegulatorAssignmentsService } from '../regulator-assignments/regulator-assignments.service';
import { PdfService } from '../pdf/pdf.service';
import { VIEW_DASHBOARD_ROLES } from '../cooperatives/roles.constants';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { AiClientService } from './ai-client.service';
import { AskAssistantDto } from './dto/ask-assistant.dto';
import { GenerateCustomReportDto } from './dto/generate-custom-report.dto';

interface DashboardSummaryLike {
  activeMembers: number;
  pendingApplications: number;
  totalSavingsBalance: string;
  totalOutstandingLoans: string;
  loansDisbursedThisMonth: string;
  cashBalance: string;
  totalIncome: string;
  totalExpense: string;
  netSurplus: string;
  upcomingMeetings: number;
  openResolutions: number;
}

@Injectable()
export class AiService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLog: AuditLogService,
    private readonly aiClient: AiClientService,
    private readonly accounting: AccountingService,
    private readonly regulatorAssignments: RegulatorAssignmentsService,
    private readonly pdf: PdfService,
  ) {}

  /**
   * Mirrors ReportsService.computeDashboard's queries directly (rather than depending on
   * ReportsModule, which already depends on AiModule for report narratives -- importing back
   * would be a circular module dependency) so a governance caller's assistant answers can draw
   * on exactly the same cooperative-wide numbers the dashboard shows them.
   */
  private async buildGovernanceContext(
    cooperativeId: string,
  ): Promise<string[]> {
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

    return [
      `Active members: ${activeMembers}`,
      `Pending membership applications: ${pendingApplications}`,
      `Total savings balance across all members: ${(savingsAgg._sum.balance ?? new Prisma.Decimal(0)).toFixed(2)}`,
      `Total outstanding loan balance across all members: ${(loansAgg._sum.outstandingBalance ?? new Prisma.Decimal(0)).toFixed(2)}`,
      `Loans disbursed this month: ${(disbursedAgg._sum.amount ?? new Prisma.Decimal(0)).toFixed(2)}`,
      `Payments this month: ${paymentsAgg._count._all} totaling ${(paymentsAgg._sum.amount ?? new Prisma.Decimal(0)).toFixed(2)}`,
      `Open resolutions awaiting a vote: ${openResolutions}`,
      `Cash balance: ${cashBalance.toFixed(2)}`,
      `Income statement: total income ${incomeStatement.totalIncome.toFixed(2)}, total expense ${incomeStatement.totalExpense.toFixed(2)}, net surplus ${incomeStatement.netSurplus.toFixed(2)}`,
    ];
  }

  /**
   * Additional grounding data for custom reports, on top of buildGovernanceContext's
   * point-in-time numbers: a 6-month trend series, overdue loan installments, and top
   * savers -- the kind of detail an arbitrary report prompt ("delinquency", "growth",
   * "top contributors") is likely to need. Queried directly (not via ReportsService) for
   * the same circular-module reason documented on buildGovernanceContext.
   */
  private async buildTrendAndRiskContext(
    cooperativeId: string,
  ): Promise<string[]> {
    const now = new Date();
    const months: string[] = [];
    for (let i = 5; i >= 0; i--) {
      const start = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1),
      );
      const end = new Date(
        Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i + 1, 1),
      );
      const label = `${start.getUTCFullYear()}-${String(start.getUTCMonth() + 1).padStart(2, '0')}`;
      const [newMembers, disbursed, repaid] = await Promise.all([
        this.prisma.cooperativeMembership.count({
          where: { cooperativeId, joinedAt: { gte: start, lt: end } },
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
      months.push(
        `${label}: ${newMembers} new member(s), loans disbursed ${(disbursed._sum.amount ?? new Prisma.Decimal(0)).toFixed(2)}, loans repaid ${(repaid._sum.amount ?? new Prisma.Decimal(0)).toFixed(2)}`,
      );
    }

    const overdueInstallments = await this.prisma.repaymentInstallment.findMany(
      {
        where: {
          status: RepaymentInstallmentStatus.OVERDUE,
          loan: { cooperativeId },
        },
        include: {
          loan: {
            include: {
              membership: {
                include: {
                  user: { select: { firstName: true, lastName: true } },
                },
              },
            },
          },
        },
        orderBy: { dueDate: 'asc' },
        take: 10,
      },
    );

    const topSavers = await this.prisma.savingsAccount.findMany({
      where: { cooperativeId, status: SavingsAccountStatus.ACTIVE },
      include: {
        membership: {
          include: { user: { select: { firstName: true, lastName: true } } },
        },
      },
      orderBy: { balance: 'desc' },
      take: 5,
    });

    return [
      `Monthly trend (last 6 months): ${months.join(' | ')}`,
      overdueInstallments.length > 0
        ? `Overdue loan installments: ${overdueInstallments
            .map(
              (i) =>
                `${i.loan.membership.user.firstName} ${i.loan.membership.user.lastName} owes ${i.principalDue.plus(i.interestDue).minus(i.amountPaid).toFixed(2)} (due ${i.dueDate.toISOString().slice(0, 10)})`,
            )
            .join('; ')}`
        : 'Overdue loan installments: none',
      `Top savers: ${
        topSavers
          .map(
            (a) =>
              `${a.membership.user.firstName} ${a.membership.user.lastName} (${a.balance.toFixed(2)})`,
          )
          .join('; ') || 'No active savings accounts'
      }`,
    ];
  }

  async generateCustomReport(
    cooperativeId: string,
    actor: AuthenticatedUser,
    dto: GenerateCustomReportDto,
  ) {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
    });
    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    const contextLines = [
      ...(await this.buildGovernanceContext(cooperativeId)),
      ...(await this.buildTrendAndRiskContext(cooperativeId)),
    ];

    const raw = await this.aiClient.chat(
      [
        {
          role: 'system',
          content:
            'You write custom management reports for a Nigerian cooperative society, using ONLY the data given below. Never invent figures. ' +
            'Respond with STRICT JSON only (no markdown fences, no commentary) in this exact shape: ' +
            '{"title": string, "sections": [{"heading": string, "body": string}]}. ' +
            'Produce 2-5 sections directly relevant to the request. Each body should be 2-5 factual sentences. ' +
            'If the requested topic has no supporting data in the context, say so plainly in that section rather than inventing numbers.\n\nData:\n' +
            contextLines.join('\n'),
        },
        { role: 'user', content: dto.prompt },
      ],
      1500,
    );

    let title = dto.prompt;
    let sections: { heading: string; body: string }[];
    try {
      const cleaned = raw.replace(/^```(?:json)?\s*|\s*```$/g, '');
      const parsed = JSON.parse(cleaned) as {
        title?: string;
        sections?: { heading: string; body: string }[];
      };
      title = parsed.title ?? title;
      sections = Array.isArray(parsed.sections) ? parsed.sections : [];
      if (sections.length === 0) {
        sections = [{ heading: 'Report', body: raw }];
      }
    } catch {
      sections = [{ heading: 'Report', body: raw }];
    }

    const generatedAt = new Date();
    const pdf = await this.pdf.generateCustomReportPdf({
      cooperativeName: cooperative.name,
      prompt: dto.prompt,
      title,
      sections,
      generatedAt,
    });

    const fileSlug = generatedAt.toISOString().replace(/[:.]/g, '-');
    const document = await this.prisma.document.create({
      data: {
        cooperativeId,
        uploadedByUserId: actor.userId,
        title,
        category: DocumentCategory.REPORT,
        fileName: `custom-report-${fileSlug}.pdf`,
        mimeType: 'application/pdf',
        sizeBytes: pdf.length,
        content: pdf,
      },
      select: {
        id: true,
        cooperativeId: true,
        uploadedByUserId: true,
        title: true,
        category: true,
        fileName: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'report.custom_generated',
      targetType: 'Document',
      targetId: document.id,
      metadata: { prompt: dto.prompt },
    });

    return { document, title, sections };
  }

  async askAssistant(
    cooperativeId: string,
    user: AuthenticatedUser,
    dto: AskAssistantDto,
  ) {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
    });
    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }
    await this.assertMember(cooperativeId, user);

    const membership = await this.prisma.cooperativeMembership.findUnique({
      where: { cooperativeId_userId: { cooperativeId, userId: user.userId } },
      include: {
        savingsAccounts: { include: { product: true } },
        loans: { include: { product: true } },
      },
    });

    const upcomingMeetings = await this.prisma.meeting.findMany({
      where: {
        cooperativeId,
        status: MeetingStatus.SCHEDULED,
        scheduledAt: { gt: new Date() },
      },
      orderBy: { scheduledAt: 'asc' },
      take: 5,
      select: { title: true, type: true, scheduledAt: true },
    });

    const isGovernance = Boolean(
      membership &&
      (VIEW_DASHBOARD_ROLES as readonly Role[]).includes(membership.role),
    );

    const contextLines: string[] = [`Cooperative: ${cooperative.name}`];
    if (membership) {
      contextLines.push(
        `Member role: ${membership.role}, status: ${membership.status}, category: ${membership.category}`,
      );
      for (const acc of membership.savingsAccounts) {
        contextLines.push(
          `Savings account ${acc.accountNumber} (${acc.product.name}): balance ${acc.balance.toFixed(2)}`,
        );
      }
      for (const loan of membership.loans) {
        contextLines.push(
          `Loan (${loan.product.name}): principal ${loan.principal.toFixed(2)}, status ${loan.status}, outstanding ${loan.outstandingBalance.toFixed(2)}`,
        );
      }
    }
    for (const m of upcomingMeetings) {
      contextLines.push(
        `Upcoming meeting: "${m.title}" (${m.type}) at ${m.scheduledAt.toISOString()}`,
      );
    }
    if (isGovernance) {
      contextLines.push(
        '--- Cooperative-wide dashboard (visible to you because your role has dashboard access) ---',
      );
      contextLines.push(...(await this.buildGovernanceContext(cooperativeId)));
    }

    const scopeDescription = isGovernance
      ? "this member's own data plus the cooperative-wide dashboard numbers their governance role already has access to"
      : "this specific member's own data";

    const answer = await this.aiClient.chat([
      {
        role: 'system',
        content: `You are a helpful assistant for a member of a Nigerian cooperative society. Answer ONLY using the context below, which is ${scopeDescription}. Be concise (2-4 sentences). Never invent numbers not present in the context; if you don't have the data to answer, say so plainly.\n\nContext:\n${contextLines.join('\n')}`,
      },
      { role: 'user', content: dto.question },
    ]);

    return { answer };
  }

  async summarizeMeeting(
    cooperativeId: string,
    meetingId: string,
    actor: AuthenticatedUser,
  ) {
    const meeting = await this.prisma.meeting.findUnique({
      where: { id: meetingId },
      include: {
        agendaItems: { orderBy: { order: 'asc' } },
        resolutions: { include: { votes: true } },
      },
    });
    if (!meeting || meeting.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Meeting not found');
    }

    const agendaText =
      meeting.agendaItems
        .map(
          (a) =>
            `${a.order}. ${a.title}${a.description ? ` — ${a.description}` : ''}`,
        )
        .join('\n') || 'None';

    const resolutionsText =
      meeting.resolutions
        .map((r) => {
          const forCount = r.votes.filter(
            (v) => v.choice === VoteChoice.FOR,
          ).length;
          const againstCount = r.votes.filter(
            (v) => v.choice === VoteChoice.AGAINST,
          ).length;
          const abstainCount = r.votes.filter(
            (v) => v.choice === VoteChoice.ABSTAIN,
          ).length;
          return `${r.title} — ${r.status} (FOR ${forCount}, AGAINST ${againstCount}, ABSTAIN ${abstainCount})`;
        })
        .join('\n') || 'None';

    const summary = await this.aiClient.chat([
      {
        role: 'system',
        content:
          'You write clear, factual summaries of cooperative society meetings for members who could not attend. Use 3-5 short bullet points. Never invent facts beyond what is given.',
      },
      {
        role: 'user',
        content: `Meeting: ${meeting.title} (${meeting.type})\n\nAgenda:\n${agendaText}\n\nResolutions:\n${resolutionsText}\n\nMinutes:\n${meeting.minutes ?? 'Not recorded.'}`,
      },
    ]);

    const updated = await this.prisma.meeting.update({
      where: { id: meetingId },
      data: { aiSummary: summary },
    });

    await this.auditLog.record({
      cooperativeId,
      actorUserId: actor.userId,
      action: 'meeting.summarized',
      targetType: 'Meeting',
      targetId: meetingId,
    });

    return { aiSummary: updated.aiSummary };
  }

  async generateReportNarrative(
    cooperativeName: string,
    period: string,
    summary: DashboardSummaryLike,
  ): Promise<string> {
    return this.aiClient.chat([
      {
        role: 'system',
        content:
          'You write concise (3-4 sentence), factual management commentary for a Nigerian cooperative society monthly report. Never invent figures beyond what is given.',
      },
      {
        role: 'user',
        content: `Write the commentary for ${cooperativeName}'s ${period} report from these figures:\nActive members: ${summary.activeMembers}\nPending applications: ${summary.pendingApplications}\nTotal savings balance: ${summary.totalSavingsBalance}\nTotal outstanding loans: ${summary.totalOutstandingLoans}\nLoans disbursed this month: ${summary.loansDisbursedThisMonth}\nCash balance: ${summary.cashBalance}\nTotal income: ${summary.totalIncome}\nTotal expense: ${summary.totalExpense}\nNet surplus: ${summary.netSurplus}\nUpcoming meetings: ${summary.upcomingMeetings}\nOpen resolutions: ${summary.openResolutions}`,
      },
    ]);
  }

  async scoreLoanRisk(cooperativeId: string, loanId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id: loanId },
      include: {
        product: true,
        membership: {
          include: {
            savingsAccounts: true,
            loans: { include: { schedule: true } },
          },
        },
      },
    });
    if (!loan || loan.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Loan not found');
    }

    let score = 100;
    const factors: string[] = [];

    const totalSavings = loan.membership.savingsAccounts.reduce(
      (sum, acc) => sum.plus(acc.balance),
      new Prisma.Decimal(0),
    );
    const loanToSavings = totalSavings.greaterThan(0)
      ? loan.principal.dividedBy(totalSavings)
      : new Prisma.Decimal(loan.principal.greaterThan(0) ? 999 : 0);
    if (loanToSavings.greaterThan(5)) {
      score -= 30;
      factors.push(
        "Requested principal is more than 5x the member's total savings",
      );
    } else if (loanToSavings.greaterThan(2)) {
      score -= 15;
      factors.push(
        "Requested principal is more than 2x the member's total savings",
      );
    }

    const overdueCount = loan.membership.loans
      .filter((l) => l.id !== loan.id)
      .flatMap((l) => l.schedule)
      .filter((installment) => installment.status === 'OVERDUE').length;
    if (overdueCount > 0) {
      score -= Math.min(30, overdueCount * 10);
      factors.push(
        `${overdueCount} historically overdue installment(s) across this member's other loans`,
      );
    }

    const tenureDays =
      (Date.now() - loan.membership.joinedAt.getTime()) / (1000 * 60 * 60 * 24);
    if (tenureDays < 90) {
      score -= 15;
      factors.push('Member joined less than 90 days ago');
    }

    const productMaxRatio = loan.product.maxAmount.greaterThan(0)
      ? loan.principal.dividedBy(loan.product.maxAmount)
      : new Prisma.Decimal(0);
    if (productMaxRatio.greaterThanOrEqualTo(1)) {
      score -= 10;
      factors.push('Requested the maximum amount allowed by this loan product');
    }

    score = Math.max(0, Math.min(100, score));
    const rating = score >= 75 ? 'LOW' : score >= 50 ? 'MEDIUM' : 'HIGH';

    const narrative = await this.aiClient.chat([
      {
        role: 'system',
        content:
          'You explain a loan risk assessment to a cooperative society loan officer in 2-3 plain sentences. Only explain the given factors; never invent new ones.',
      },
      {
        role: 'user',
        content: `Risk score: ${score}/100 (${rating}). Factors:\n${
          factors.length
            ? factors.map((f) => `- ${f}`).join('\n')
            : '- No risk factors identified'
        }`,
      },
    ]);

    return { score, rating, factors, narrative };
  }

  async detectFraudSignals(cooperativeId: string) {
    const cooperative = await this.prisma.cooperative.findUnique({
      where: { id: cooperativeId },
    });
    if (!cooperative) {
      throw new NotFoundException('Cooperative not found');
    }

    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const transactions = await this.prisma.savingsTransaction.findMany({
      where: { account: { cooperativeId }, createdAt: { gte: since } },
      include: {
        account: {
          select: {
            id: true,
            accountNumber: true,
            membership: {
              select: { user: { select: { firstName: true, lastName: true } } },
            },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const flags: {
      type: string;
      description: string;
      accountNumber: string;
      member: string;
      createdAt: string;
    }[] = [];

    const byAccount = new Map<string, typeof transactions>();
    for (const t of transactions) {
      const list = byAccount.get(t.accountId) ?? [];
      list.push(t);
      byAccount.set(t.accountId, list);
    }

    for (const txs of byAccount.values()) {
      const amounts = txs.map((t) => Number(t.amount));
      const avg = amounts.reduce((s, a) => s + a, 0) / amounts.length;

      for (const t of txs) {
        const amount = Number(t.amount);
        if (avg > 0 && amount > avg * 5 && amount > 1000) {
          flags.push({
            type: 'LARGE_TRANSACTION',
            description: `${t.type} of ${t.amount.toFixed(2)} is more than 5x this account's recent average (${avg.toFixed(2)})`,
            accountNumber: t.account.accountNumber,
            member: `${t.account.membership.user.firstName} ${t.account.membership.user.lastName}`,
            createdAt: t.createdAt.toISOString(),
          });
        }
      }

      for (let i = 0; i < txs.length - 1; i++) {
        const a = txs[i];
        const b = txs[i + 1];
        if (
          a.type === 'DEPOSIT' &&
          b.type === 'WITHDRAWAL' &&
          Math.abs(b.createdAt.getTime() - a.createdAt.getTime()) <
            60 * 60 * 1000 &&
          Number(a.amount) === Number(b.amount)
        ) {
          flags.push({
            type: 'RAPID_ROUND_TRIP',
            description: `Deposit of ${a.amount.toFixed(2)} followed by an equal withdrawal within an hour`,
            accountNumber: a.account.accountNumber,
            member: `${a.account.membership.user.firstName} ${a.account.membership.user.lastName}`,
            createdAt: b.createdAt.toISOString(),
          });
        }
      }
    }

    return flags;
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
}
