"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  ApiError,
  type Account,
  type AccountType,
  type BudgetVsActual,
  type IncomeStatement,
  type BalanceSheet,
  type JournalEntry,
  type TrialBalanceRow,
} from "@/lib/api";

const ACCOUNT_TYPES: AccountType[] = ["ASSET", "LIABILITY", "EQUITY", "INCOME", "EXPENSE"];

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

export default function AccountingSection({ cooperativeId }: { cooperativeId: string }) {
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [journalEntries, setJournalEntries] = useState<JournalEntry[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceRow[]>([]);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatement | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheet | null>(null);
  const [budgets, setBudgets] = useState<BudgetVsActual[]>([]);

  const [accountCode, setAccountCode] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountType, setAccountType] = useState<AccountType>("ASSET");
  const [accountError, setAccountError] = useState<string | null>(null);

  const [debitAccountId, setDebitAccountId] = useState("");
  const [creditAccountId, setCreditAccountId] = useState("");
  const [entryAmount, setEntryAmount] = useState("");
  const [entryMemo, setEntryMemo] = useState("");
  const [entryError, setEntryError] = useState<string | null>(null);

  const [budgetAccountId, setBudgetAccountId] = useState("");
  const [budgetPeriod, setBudgetPeriod] = useState("");
  const [budgetAmount, setBudgetAmount] = useState("");
  const [budgetError, setBudgetError] = useState<string | null>(null);
  const [budgetFilter, setBudgetFilter] = useState("");

  async function reload(period?: string) {
    try {
      const [accts, entries, tb, income, balance, budgetRows] = await Promise.all([
        api.listAccounts(cooperativeId),
        api.listJournalEntries(cooperativeId),
        api.getTrialBalance(cooperativeId),
        api.getIncomeStatement(cooperativeId),
        api.getBalanceSheet(cooperativeId),
        api.getBudgetVsActual(cooperativeId, period),
      ]);
      setAccounts(accts);
      setJournalEntries(entries);
      setTrialBalance(tb);
      setIncomeStatement(income);
      setBalanceSheet(balance);
      setBudgets(budgetRows);
    } catch {
      setAccounts(null);
    }
  }

  useEffect(() => {
    async function load() {
      await reload();
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooperativeId]);

  async function onCreateAccount(e: FormEvent) {
    e.preventDefault();
    setAccountError(null);
    try {
      await api.createAccount(cooperativeId, { code: accountCode, name: accountName, type: accountType });
      setAccountCode("");
      setAccountName("");
      setAccounts(await api.listAccounts(cooperativeId));
    } catch (err) {
      setAccountError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onPostEntry(e: FormEvent) {
    e.preventDefault();
    setEntryError(null);
    if (!debitAccountId || !creditAccountId) {
      setEntryError("Choose both a debit and credit account");
      return;
    }
    if (debitAccountId === creditAccountId) {
      setEntryError("Debit and credit accounts must be different");
      return;
    }
    try {
      await api.createJournalEntry(cooperativeId, {
        memo: entryMemo || undefined,
        lines: [
          { accountId: debitAccountId, debit: Number(entryAmount) },
          { accountId: creditAccountId, credit: Number(entryAmount) },
        ],
      });
      setDebitAccountId("");
      setCreditAccountId("");
      setEntryAmount("");
      setEntryMemo("");
      await reload(budgetFilter || undefined);
    } catch (err) {
      setEntryError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onSetBudget(e: FormEvent) {
    e.preventDefault();
    setBudgetError(null);
    if (!budgetAccountId || !budgetPeriod) {
      setBudgetError("Choose an account and a period");
      return;
    }
    try {
      await api.upsertBudget(cooperativeId, {
        accountId: budgetAccountId,
        period: budgetPeriod,
        plannedAmount: Number(budgetAmount),
      });
      setBudgetAmount("");
      setBudgets(await api.getBudgetVsActual(cooperativeId, budgetFilter || undefined));
    } catch (err) {
      setBudgetError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (!accounts) return null;

  return (
    <>
      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Chart of accounts</h2>
        <ErrorText message={accountError} />
        <ul className="space-y-1 text-sm">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center justify-between">
              <span>
                {a.code} — {a.name}
              </span>
              <span className="text-xs text-zinc-500">
                {a.type}
                {a.isSystem && " · system"}
              </span>
            </li>
          ))}
        </ul>
        <form onSubmit={onCreateAccount} className="flex flex-wrap gap-2">
          <input
            className="w-24 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Code"
            value={accountCode}
            onChange={(e) => setAccountCode(e.target.value)}
            required
          />
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Name"
            value={accountName}
            onChange={(e) => setAccountName(e.target.value)}
            required
          />
          <select
            className="rounded-md border border-black/[.08] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.145]"
            value={accountType}
            onChange={(e) => setAccountType(e.target.value as AccountType)}
          >
            {ACCOUNT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Add
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Trial balance</h2>
        <ul className="space-y-1 text-sm">
          {trialBalance
            .filter((r) => !r.totalDebit.startsWith("0") || !r.totalCredit.startsWith("0"))
            .map((r) => (
              <li key={r.account.id} className="flex items-center justify-between">
                <span>
                  {r.account.code} — {r.account.name}
                </span>
                <span className="text-xs text-zinc-500">
                  dr {r.totalDebit} · cr {r.totalCredit} · bal {r.balance}
                </span>
              </li>
            ))}
          {trialBalance.every((r) => r.totalDebit === "0" && r.totalCredit === "0") && (
            <li className="text-zinc-500 dark:text-zinc-500">No activity posted yet.</li>
          )}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Journal entries</h2>
        <ErrorText message={entryError} />
        <ul className="space-y-2 text-sm">
          {journalEntries.map((entry) => (
            <li key={entry.id}>
              <div className="flex items-center justify-between">
                <span>
                  {new Date(entry.date).toLocaleDateString()} — {entry.memo ?? entry.source}
                </span>
                <span className="text-xs text-zinc-500">{entry.source}</span>
              </div>
              <ul className="pl-3 text-xs text-zinc-500">
                {entry.lines.map((line) => (
                  <li key={line.id}>
                    {line.account?.code} {line.account?.name}: dr {line.debit} / cr {line.credit}
                  </li>
                ))}
              </ul>
            </li>
          ))}
          {journalEntries.length === 0 && (
            <li className="text-zinc-500 dark:text-zinc-500">No journal entries yet.</li>
          )}
        </ul>
        <form onSubmit={onPostEntry} className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-black/[.08] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.145]"
            value={debitAccountId}
            onChange={(e) => setDebitAccountId(e.target.value)}
          >
            <option value="">Debit account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-black/[.08] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.145]"
            value={creditAccountId}
            onChange={(e) => setCreditAccountId(e.target.value)}
          >
            <option value="">Credit account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
          <input
            className="w-28 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Amount"
            value={entryAmount}
            onChange={(e) => setEntryAmount(e.target.value)}
            required
          />
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Memo"
            value={entryMemo}
            onChange={(e) => setEntryMemo(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Post entry
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Income statement</h2>
        {incomeStatement && (
          <div className="text-sm">
            <p>Total income: ₦{incomeStatement.totalIncome}</p>
            <p>Total expense: ₦{incomeStatement.totalExpense}</p>
            <p className="font-medium">Net surplus: ₦{incomeStatement.netSurplus}</p>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Balance sheet</h2>
        {balanceSheet && (
          <div className="text-sm">
            <p>Total assets: ₦{balanceSheet.totalAssets}</p>
            <p>Total liabilities: ₦{balanceSheet.totalLiabilities}</p>
            <p>Total equity: ₦{balanceSheet.totalEquity}</p>
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Budgets</h2>
        <ErrorText message={budgetError} />
        <div className="flex items-center gap-2">
          <input
            className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
            placeholder="Filter by period"
            value={budgetFilter}
            onChange={async (e) => {
              setBudgetFilter(e.target.value);
              setBudgets(await api.getBudgetVsActual(cooperativeId, e.target.value || undefined));
            }}
          />
        </div>
        <ul className="space-y-1 text-sm">
          {budgets.map((b) => (
            <li key={b.budget.id} className="flex items-center justify-between">
              <span>
                {b.budget.account?.code} {b.budget.account?.name} ({b.budget.period})
              </span>
              <span className="text-xs text-zinc-500">
                planned ₦{b.budget.plannedAmount} · actual ₦{b.actual} · variance ₦{b.variance}
              </span>
            </li>
          ))}
          {budgets.length === 0 && (
            <li className="text-zinc-500 dark:text-zinc-500">No budgets set yet.</li>
          )}
        </ul>
        <form onSubmit={onSetBudget} className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-black/[.08] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.145]"
            value={budgetAccountId}
            onChange={(e) => setBudgetAccountId(e.target.value)}
          >
            <option value="">Account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} {a.name}
              </option>
            ))}
          </select>
          <input
            className="w-24 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Period"
            value={budgetPeriod}
            onChange={(e) => setBudgetPeriod(e.target.value)}
            required
          />
          <input
            className="w-28 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Planned amount"
            value={budgetAmount}
            onChange={(e) => setBudgetAmount(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Set budget
          </button>
        </form>
      </section>
    </>
  );
}
