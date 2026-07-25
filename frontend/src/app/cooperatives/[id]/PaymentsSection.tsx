"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  ApiError,
  type AuthUser,
  type BankAccountStatus,
  type Loan,
  type Payment,
  type SavingsAccount,
} from "@/lib/api";

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

function statusColor(status: string) {
  if (status === "SUCCESS") return "text-green-600 dark:text-green-400";
  if (status === "FAILED") return "text-red-600 dark:text-red-400";
  return "text-zinc-500";
}

function paymentLabel(p: Payment) {
  if (p.purpose === "SAVINGS_DEPOSIT") {
    return `Savings deposit${p.savingsAccount ? ` — ${p.savingsAccount.product?.name ?? ""} (${p.savingsAccount.accountNumber})` : ""}`;
  }
  return `Loan repayment${p.loan?.product ? ` — ${p.loan.product.name}` : ""}`;
}

export default function PaymentsSection({ cooperativeId, me }: { cooperativeId: string; me: AuthUser | null }) {
  const [mySavingsAccounts, setMySavingsAccounts] = useState<SavingsAccount[]>([]);
  const [myActiveLoans, setMyActiveLoans] = useState<Loan[]>([]);
  const [myPayments, setMyPayments] = useState<Payment[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[] | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [bankStatus, setBankStatus] = useState<BankAccountStatus | null>(null);

  const [purpose, setPurpose] = useState<"SAVINGS_DEPOSIT" | "LOAN_REPAYMENT">("SAVINGS_DEPOSIT");
  const [targetId, setTargetId] = useState("");
  const [amount, setAmount] = useState("");
  const [narration, setNarration] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function reload() {
    if (!me) return;
    const [accounts, loans, payments] = await Promise.all([
      api.listSavingsAccountsForMember(cooperativeId, me.id),
      api.listLoansForMember(cooperativeId, me.id),
      api.listPaymentsForMember(cooperativeId, me.id),
    ]);
    setMySavingsAccounts(accounts);
    setMyActiveLoans(loans.filter((l) => l.status === "ACTIVE"));
    setMyPayments(payments);
    // Real payments require Paystack to be configured; if it isn't, treat
    // the cooperative as not having connected a bank account yet rather
    // than breaking the rest of this section.
    try {
      setBankStatus(await api.getBankAccountStatus(cooperativeId));
    } catch {
      setBankStatus(null);
    }
    await reloadAllPayments();
  }

  async function reloadAllPayments(status?: string) {
    try {
      setAllPayments(await api.listPaymentsForCooperative(cooperativeId, status || undefined));
    } catch {
      setAllPayments(null);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        await reload();
      } catch {
        // sections stay empty on failure; individual actions surface their own errors
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooperativeId, me?.id]);

  async function onInitiate(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!targetId) {
      setFormError("Choose a savings account or loan first");
      return;
    }
    try {
      const payment = await api.initiatePayment(cooperativeId, {
        purpose,
        targetId,
        amount: Number(amount),
        narration: narration || undefined,
      });
      if (payment.authorizationUrl) {
        window.location.href = payment.authorizationUrl;
      }
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onCheckStatus(paymentId: string) {
    setActionError(null);
    try {
      await api.verifyPayment(cooperativeId, paymentId);
      if (me) setMyPayments(await api.listPaymentsForMember(cooperativeId, me.id));
      await reloadAllPayments(statusFilter);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  function renderPaymentRow(p: Payment, showMember: boolean) {
    return (
      <li key={p.id} className="flex items-center justify-between text-sm">
        <span>
          {showMember && p.membership && (
            <>
              {p.membership.user.firstName} {p.membership.user.lastName} —{" "}
            </>
          )}
          {paymentLabel(p)} · ₦{p.amount}{" "}
          <span className="text-xs text-zinc-500">({p.gatewayReference})</span>
        </span>
        <span className="flex items-center gap-2">
          <span className={`text-xs ${statusColor(p.status)}`}>{p.status}</span>
          {p.status === "INITIATED" && (
            <>
              {p.authorizationUrl && (
                <a
                  href={p.authorizationUrl}
                  className="rounded-full border border-black/[.08] px-2 py-0.5 text-xs font-medium dark:border-white/[.145]"
                >
                  Continue to checkout
                </a>
              )}
              <button
                onClick={() => onCheckStatus(p.id)}
                className="text-xs text-zinc-600 hover:underline dark:text-zinc-400"
              >
                Check status
              </button>
            </>
          )}
        </span>
      </li>
    );
  }

  return (
    <>
      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Make a payment</h2>
        <ErrorText message={formError} />
        {bankStatus && !bankStatus.connected && (
          <p className="text-sm text-amber-600 dark:text-amber-400">
            This cooperative hasn&apos;t connected a bank account yet — ask your cooperative admin to set one up in
            Settings before paying.
          </p>
        )}
        <form onSubmit={onInitiate} className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-black/[.08] bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm dark:border-white/[.145]"
            value={purpose}
            onChange={(e) => {
              setPurpose(e.target.value as "SAVINGS_DEPOSIT" | "LOAN_REPAYMENT");
              setTargetId("");
            }}
          >
            <option value="SAVINGS_DEPOSIT">Savings deposit</option>
            <option value="LOAN_REPAYMENT">Loan repayment</option>
          </select>
          <select
            className="rounded-md border border-black/[.08] bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm dark:border-white/[.145]"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
          >
            <option value="">Choose…</option>
            {purpose === "SAVINGS_DEPOSIT"
              ? mySavingsAccounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.product?.name} ({a.accountNumber})
                  </option>
                ))
              : myActiveLoans.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.product?.name} — bal ₦{l.outstandingBalance}
                  </option>
                ))}
          </select>
          <input
            className="w-28 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Amount"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            required
          />
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Narration"
            value={narration}
            onChange={(e) => setNarration(e.target.value)}
          />
          <button
            type="submit"
            disabled={!bankStatus?.connected}
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Pay
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">My payments</h2>
        <ErrorText message={actionError} />
        <ul className="space-y-2">{myPayments.map((p) => renderPaymentRow(p, false))}</ul>
        {myPayments.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-500">No payments yet.</p>}
      </section>

      {allPayments && (
        <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-black dark:text-zinc-50">Payment reconciliation</h2>
            <select
              className="rounded-md border border-black/[.08] bg-white dark:bg-zinc-900 px-2 py-1 text-xs dark:border-white/[.145]"
              value={statusFilter}
              onChange={async (e) => {
                setStatusFilter(e.target.value);
                await reloadAllPayments(e.target.value);
              }}
            >
              <option value="">All statuses</option>
              <option value="INITIATED">Initiated</option>
              <option value="SUCCESS">Success</option>
              <option value="FAILED">Failed</option>
            </select>
          </div>
          <ul className="space-y-2">{allPayments.map((p) => renderPaymentRow(p, true))}</ul>
          {allPayments.length === 0 && <p className="text-sm text-zinc-500 dark:text-zinc-500">No payments yet.</p>}
        </section>
      )}
    </>
  );
}
