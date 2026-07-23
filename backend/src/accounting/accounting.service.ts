import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AccountType, JournalEntrySource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateAccountDto } from './dto/create-account.dto';
import { CreateJournalEntryDto } from './dto/create-journal-entry.dto';
import { UpsertBudgetDto } from './dto/upsert-budget.dto';

export const SYSTEM_ACCOUNTS = {
  CASH_AND_BANK: {
    code: '1000',
    name: 'Cash and Bank',
    type: AccountType.ASSET,
  },
  LOANS_RECEIVABLE: {
    code: '1100',
    name: 'Loans Receivable',
    type: AccountType.ASSET,
  },
  MEMBER_SAVINGS: {
    code: '2000',
    name: 'Member Savings',
    type: AccountType.LIABILITY,
  },
  INTEREST_INCOME: {
    code: '4000',
    name: 'Interest Income',
    type: AccountType.INCOME,
  },
  PENALTY_INCOME: {
    code: '4100',
    name: 'Penalty Income',
    type: AccountType.INCOME,
  },
  SAVINGS_INTEREST_EXPENSE: {
    code: '5000',
    name: 'Savings Interest Expense',
    type: AccountType.EXPENSE,
  },
} as const;

@Injectable()
export class AccountingService {
  constructor(private readonly prisma: PrismaService) {}

  async ensureDefaultChart(cooperativeId: string) {
    // A single skip-duplicates bulk insert, so two concurrent requests
    // seeding the same brand-new cooperative can't race each other into a
    // unique-constraint violation the way a per-row upsert loop can.
    await this.prisma.account.createMany({
      data: Object.values(SYSTEM_ACCOUNTS).map((account) => ({
        cooperativeId,
        ...account,
        isSystem: true,
      })),
      skipDuplicates: true,
    });
  }

  async listAccounts(cooperativeId: string) {
    await this.ensureDefaultChart(cooperativeId);
    return this.prisma.account.findMany({
      where: { cooperativeId },
      orderBy: { code: 'asc' },
    });
  }

  async createAccount(cooperativeId: string, dto: CreateAccountDto) {
    const existing = await this.prisma.account.findUnique({
      where: { cooperativeId_code: { cooperativeId, code: dto.code } },
    });
    if (existing) {
      throw new BadRequestException('An account with this code already exists');
    }
    return this.prisma.account.create({ data: { cooperativeId, ...dto } });
  }

  async createJournalEntry(
    cooperativeId: string,
    postedByUserId: string,
    dto: CreateJournalEntryDto,
  ) {
    let totalDebit = new Prisma.Decimal(0);
    let totalCredit = new Prisma.Decimal(0);
    for (const line of dto.lines) {
      const debit = new Prisma.Decimal(line.debit ?? 0);
      const credit = new Prisma.Decimal(line.credit ?? 0);
      if (debit.greaterThan(0) === credit.greaterThan(0)) {
        throw new BadRequestException(
          'Each line must have exactly one of debit or credit greater than zero',
        );
      }
      const account = await this.prisma.account.findUnique({
        where: { id: line.accountId },
      });
      if (!account || account.cooperativeId !== cooperativeId) {
        throw new NotFoundException(`Account ${line.accountId} not found`);
      }
      totalDebit = totalDebit.plus(debit);
      totalCredit = totalCredit.plus(credit);
    }
    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Journal entry does not balance: debits ${totalDebit.toString()} vs credits ${totalCredit.toString()}`,
      );
    }
    if (totalDebit.lessThanOrEqualTo(0)) {
      throw new BadRequestException(
        'Journal entry must move a non-zero amount',
      );
    }

    return this.prisma.journalEntry.create({
      data: {
        cooperativeId,
        memo: dto.memo,
        postedByUserId,
        lines: {
          create: dto.lines.map((line) => ({
            accountId: line.accountId,
            debit: line.debit ?? 0,
            credit: line.credit ?? 0,
          })),
        },
      },
      include: { lines: { include: { account: true } } },
    });
  }

  async listJournalEntries(cooperativeId: string, accountId?: string) {
    return this.prisma.journalEntry.findMany({
      where: {
        cooperativeId,
        lines: accountId ? { some: { accountId } } : undefined,
      },
      include: {
        lines: { include: { account: true } },
        postedBy: {
          select: { id: true, email: true, firstName: true, lastName: true },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async getTrialBalance(cooperativeId: string) {
    const accounts = await this.listAccounts(cooperativeId);
    const totals = await this.prisma.journalLine.groupBy({
      by: ['accountId'],
      where: { account: { cooperativeId } },
      _sum: { debit: true, credit: true },
    });
    const totalsByAccount = new Map(
      totals.map((t) => [
        t.accountId,
        {
          debit: t._sum.debit ?? new Prisma.Decimal(0),
          credit: t._sum.credit ?? new Prisma.Decimal(0),
        },
      ]),
    );
    return accounts.map((account) => {
      const t = totalsByAccount.get(account.id) ?? {
        debit: new Prisma.Decimal(0),
        credit: new Prisma.Decimal(0),
      };
      return {
        account,
        totalDebit: t.debit,
        totalCredit: t.credit,
        balance: t.debit.minus(t.credit),
      };
    });
  }

  async getIncomeStatement(cooperativeId: string) {
    const trialBalance = await this.getTrialBalance(cooperativeId);
    const income = trialBalance.filter(
      (r) => r.account.type === AccountType.INCOME,
    );
    const expense = trialBalance.filter(
      (r) => r.account.type === AccountType.EXPENSE,
    );
    const totalIncome = income.reduce(
      (sum, r) => sum.plus(r.balance.negated()),
      new Prisma.Decimal(0),
    );
    const totalExpense = expense.reduce(
      (sum, r) => sum.plus(r.balance),
      new Prisma.Decimal(0),
    );
    return {
      income,
      expense,
      totalIncome,
      totalExpense,
      netSurplus: totalIncome.minus(totalExpense),
    };
  }

  async getBalanceSheet(cooperativeId: string) {
    const trialBalance = await this.getTrialBalance(cooperativeId);
    const assets = trialBalance.filter(
      (r) => r.account.type === AccountType.ASSET,
    );
    const liabilities = trialBalance.filter(
      (r) => r.account.type === AccountType.LIABILITY,
    );
    const equity = trialBalance.filter(
      (r) => r.account.type === AccountType.EQUITY,
    );
    const totalAssets = assets.reduce(
      (sum, r) => sum.plus(r.balance),
      new Prisma.Decimal(0),
    );
    const totalLiabilities = liabilities.reduce(
      (sum, r) => sum.plus(r.balance.negated()),
      new Prisma.Decimal(0),
    );
    const totalEquity = equity.reduce(
      (sum, r) => sum.plus(r.balance.negated()),
      new Prisma.Decimal(0),
    );
    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
    };
  }

  async upsertBudget(cooperativeId: string, dto: UpsertBudgetDto) {
    const account = await this.prisma.account.findUnique({
      where: { id: dto.accountId },
    });
    if (!account || account.cooperativeId !== cooperativeId) {
      throw new NotFoundException('Account not found');
    }
    return this.prisma.budget.upsert({
      where: {
        accountId_period: { accountId: dto.accountId, period: dto.period },
      },
      create: {
        cooperativeId,
        accountId: dto.accountId,
        period: dto.period,
        plannedAmount: dto.plannedAmount,
      },
      update: { plannedAmount: dto.plannedAmount },
    });
  }

  async getBudgetVsActual(cooperativeId: string, period?: string) {
    const budgets = await this.prisma.budget.findMany({
      where: { cooperativeId, period },
      include: { account: true },
      orderBy: [{ period: 'desc' }, { account: { code: 'asc' } }],
    });
    const trialBalance = await this.getTrialBalance(cooperativeId);
    const balanceByAccount = new Map(
      trialBalance.map((r) => [r.account.id, r.balance]),
    );
    return budgets.map((budget) => {
      const rawActual =
        balanceByAccount.get(budget.accountId) ?? new Prisma.Decimal(0);
      const actual =
        budget.account.type === AccountType.INCOME ||
        budget.account.type === AccountType.LIABILITY
          ? rawActual.negated()
          : rawActual;
      return {
        budget,
        actual,
        variance: budget.plannedAmount.minus(actual),
      };
    });
  }

  // --- Auto-posting from savings/loan activity ---

  private async getSystemAccountId(
    cooperativeId: string,
    key: keyof typeof SYSTEM_ACCOUNTS,
  ): Promise<string> {
    const spec = SYSTEM_ACCOUNTS[key];
    try {
      const account = await this.prisma.account.upsert({
        where: { cooperativeId_code: { cooperativeId, code: spec.code } },
        create: { cooperativeId, ...spec, isSystem: true },
        update: {},
      });
      return account.id;
    } catch (err) {
      // Two concurrent postings for a brand-new cooperative can race to
      // create the same system account; fall back to the row the other
      // request just created.
      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002'
      ) {
        const account = await this.prisma.account.findUniqueOrThrow({
          where: { cooperativeId_code: { cooperativeId, code: spec.code } },
        });
        return account.id;
      }
      throw err;
    }
  }

  private async postEntry(
    cooperativeId: string,
    source: JournalEntrySource,
    sourceId: string,
    memo: string,
    lines: { accountId: string; debit?: number; credit?: number }[],
  ) {
    const existing = await this.prisma.journalEntry.findUnique({
      where: { sourceId },
    });
    if (existing) return existing;
    return this.prisma.journalEntry.create({
      data: {
        cooperativeId,
        source,
        sourceId,
        memo,
        lines: {
          create: lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit ?? 0,
            credit: l.credit ?? 0,
          })),
        },
      },
    });
  }

  async postSavingsDeposit(
    cooperativeId: string,
    amount: number,
    sourceId: string,
  ) {
    const [cash, memberSavings] = await Promise.all([
      this.getSystemAccountId(cooperativeId, 'CASH_AND_BANK'),
      this.getSystemAccountId(cooperativeId, 'MEMBER_SAVINGS'),
    ]);
    return this.postEntry(
      cooperativeId,
      JournalEntrySource.SAVINGS,
      sourceId,
      'Savings deposit',
      [
        { accountId: cash, debit: amount },
        { accountId: memberSavings, credit: amount },
      ],
    );
  }

  async postSavingsWithdrawal(
    cooperativeId: string,
    amount: number,
    sourceId: string,
  ) {
    const [cash, memberSavings] = await Promise.all([
      this.getSystemAccountId(cooperativeId, 'CASH_AND_BANK'),
      this.getSystemAccountId(cooperativeId, 'MEMBER_SAVINGS'),
    ]);
    return this.postEntry(
      cooperativeId,
      JournalEntrySource.SAVINGS,
      sourceId,
      'Savings withdrawal',
      [
        { accountId: memberSavings, debit: amount },
        { accountId: cash, credit: amount },
      ],
    );
  }

  async postSavingsInterest(
    cooperativeId: string,
    amount: number,
    sourceId: string,
  ) {
    const [expense, memberSavings] = await Promise.all([
      this.getSystemAccountId(cooperativeId, 'SAVINGS_INTEREST_EXPENSE'),
      this.getSystemAccountId(cooperativeId, 'MEMBER_SAVINGS'),
    ]);
    return this.postEntry(
      cooperativeId,
      JournalEntrySource.SAVINGS,
      sourceId,
      'Savings interest accrued',
      [
        { accountId: expense, debit: amount },
        { accountId: memberSavings, credit: amount },
      ],
    );
  }

  async postLoanDisbursement(
    cooperativeId: string,
    principal: number,
    sourceId: string,
  ) {
    const [receivable, cash] = await Promise.all([
      this.getSystemAccountId(cooperativeId, 'LOANS_RECEIVABLE'),
      this.getSystemAccountId(cooperativeId, 'CASH_AND_BANK'),
    ]);
    return this.postEntry(
      cooperativeId,
      JournalEntrySource.LOAN,
      sourceId,
      'Loan disbursement',
      [
        { accountId: receivable, debit: principal },
        { accountId: cash, credit: principal },
      ],
    );
  }

  async postLoanRepayment(
    cooperativeId: string,
    principalPortion: number,
    interestPortion: number,
    sourceId: string,
  ) {
    const [cash, receivable, income] = await Promise.all([
      this.getSystemAccountId(cooperativeId, 'CASH_AND_BANK'),
      this.getSystemAccountId(cooperativeId, 'LOANS_RECEIVABLE'),
      this.getSystemAccountId(cooperativeId, 'INTEREST_INCOME'),
    ]);
    const total = principalPortion + interestPortion;
    const lines: { accountId: string; debit?: number; credit?: number }[] = [
      { accountId: cash, debit: total },
    ];
    if (principalPortion > 0)
      lines.push({ accountId: receivable, credit: principalPortion });
    if (interestPortion > 0)
      lines.push({ accountId: income, credit: interestPortion });
    return this.postEntry(
      cooperativeId,
      JournalEntrySource.LOAN,
      sourceId,
      'Loan repayment',
      lines,
    );
  }

  async postLoanPenalty(
    cooperativeId: string,
    amount: number,
    sourceId: string,
  ) {
    const [receivable, income] = await Promise.all([
      this.getSystemAccountId(cooperativeId, 'LOANS_RECEIVABLE'),
      this.getSystemAccountId(cooperativeId, 'PENALTY_INCOME'),
    ]);
    return this.postEntry(
      cooperativeId,
      JournalEntrySource.LOAN,
      sourceId,
      'Loan penalty assessed',
      [
        { accountId: receivable, debit: amount },
        { accountId: income, credit: amount },
      ],
    );
  }
}
