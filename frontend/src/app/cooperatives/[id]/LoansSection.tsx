"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  ApiError,
  type AuthUser,
  type Loan,
  type LoanGuarantor,
  type LoanProduct,
} from "@/lib/api";

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

function statusColor(status: string) {
  if (status === "ACTIVE" || status === "APPROVED") return "text-green-600 dark:text-green-400";
  if (status === "REJECTED" || status === "DEFAULTED") return "text-red-600 dark:text-red-400";
  if (status === "COMPLETED") return "text-zinc-500";
  return "text-zinc-500";
}

export default function LoansSection({ cooperativeId, me }: { cooperativeId: string; me: AuthUser | null }) {
  const [products, setProducts] = useState<LoanProduct[]>([]);
  const [myLoans, setMyLoans] = useState<Loan[]>([]);
  const [guarantorRequests, setGuarantorRequests] = useState<LoanGuarantor[]>([]);
  const [allLoans, setAllLoans] = useState<Loan[] | null>(null);
  const [loanDetails, setLoanDetails] = useState<Record<string, Loan>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const [productName, setProductName] = useState("");
  const [productCode, setProductCode] = useState("");
  const [productRate, setProductRate] = useState("0");
  const [productMaxAmount, setProductMaxAmount] = useState("");
  const [productMaxTerm, setProductMaxTerm] = useState("12");
  const [productPenaltyRate, setProductPenaltyRate] = useState("0");
  const [productRequiredGuarantors, setProductRequiredGuarantors] = useState("0");
  const [productError, setProductError] = useState<string | null>(null);

  const [applyProductId, setApplyProductId] = useState("");
  const [applyPrincipal, setApplyPrincipal] = useState("");
  const [applyTermMonths, setApplyTermMonths] = useState("");
  const [applyError, setApplyError] = useState<string | null>(null);

  const [guarantorEmailDrafts, setGuarantorEmailDrafts] = useState<Record<string, string>>({});
  const [repaymentDrafts, setRepaymentDrafts] = useState<Record<string, { amount: string; narration: string }>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  async function reload() {
    setProducts(await api.listLoanProducts(cooperativeId));
    if (me) {
      setMyLoans(await api.listLoansForMember(cooperativeId, me.id));
    }
    setGuarantorRequests(await api.listGuarantorRequestsForUser(cooperativeId));
    try {
      setAllLoans(await api.listLoansForCooperative(cooperativeId));
    } catch {
      setAllLoans(null);
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

  async function refreshLoanDetail(loanId: string) {
    const detail = await api.getLoan(cooperativeId, loanId);
    setLoanDetails((prev) => ({ ...prev, [loanId]: detail }));
  }

  async function onToggleExpand(loanId: string) {
    const willOpen = !expanded[loanId];
    if (willOpen && !loanDetails[loanId]) {
      await refreshLoanDetail(loanId);
    }
    setExpanded((prev) => ({ ...prev, [loanId]: willOpen }));
  }

  async function onCreateProduct(e: FormEvent) {
    e.preventDefault();
    setProductError(null);
    try {
      await api.createLoanProduct(cooperativeId, {
        name: productName,
        code: productCode,
        interestRatePercent: Number(productRate),
        maxAmount: Number(productMaxAmount),
        maxTermMonths: Number(productMaxTerm),
        penaltyRatePercent: Number(productPenaltyRate),
        requiredGuarantors: Number(productRequiredGuarantors),
      });
      setProductName("");
      setProductCode("");
      setProductRate("0");
      setProductMaxAmount("");
      setProductMaxTerm("12");
      setProductPenaltyRate("0");
      setProductRequiredGuarantors("0");
      setProducts(await api.listLoanProducts(cooperativeId));
    } catch (err) {
      setProductError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onApply(e: FormEvent) {
    e.preventDefault();
    setApplyError(null);
    try {
      await api.applyForLoan(cooperativeId, {
        productId: applyProductId,
        principal: Number(applyPrincipal),
        termMonths: Number(applyTermMonths),
      });
      setApplyPrincipal("");
      setApplyTermMonths("");
      if (me) setMyLoans(await api.listLoansForMember(cooperativeId, me.id));
    } catch (err) {
      setApplyError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onAddGuarantor(loanId: string) {
    const email = guarantorEmailDrafts[loanId];
    if (!email) return;
    setActionError(null);
    try {
      await api.addLoanGuarantor(cooperativeId, loanId, { email });
      setGuarantorEmailDrafts((prev) => ({ ...prev, [loanId]: "" }));
      await refreshLoanDetail(loanId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onRespondGuarantorRequest(loanId: string, guarantorId: string, status: "APPROVED" | "DECLINED") {
    setActionError(null);
    try {
      await api.respondToLoanGuarantorRequest(cooperativeId, loanId, guarantorId, status);
      setGuarantorRequests(await api.listGuarantorRequestsForUser(cooperativeId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onApprove(loanId: string) {
    setActionError(null);
    try {
      await api.approveLoan(cooperativeId, loanId);
      setAllLoans(await api.listLoansForCooperative(cooperativeId));
      await refreshLoanDetail(loanId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onReject(loanId: string) {
    setActionError(null);
    try {
      await api.rejectLoan(cooperativeId, loanId, "Rejected by governance");
      setAllLoans(await api.listLoansForCooperative(cooperativeId));
      await refreshLoanDetail(loanId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onDisburse(loanId: string) {
    setActionError(null);
    try {
      await api.disburseLoan(cooperativeId, loanId);
      setAllLoans(await api.listLoansForCooperative(cooperativeId));
      await refreshLoanDetail(loanId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onRecordRepayment(loanId: string) {
    const draft = repaymentDrafts[loanId];
    if (!draft?.amount) return;
    setActionError(null);
    try {
      await api.recordLoanRepayment(cooperativeId, loanId, {
        amount: Number(draft.amount),
        narration: draft.narration || undefined,
      });
      setRepaymentDrafts((prev) => ({ ...prev, [loanId]: { amount: "", narration: "" } }));
      setAllLoans(await api.listLoansForCooperative(cooperativeId));
      await refreshLoanDetail(loanId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onAssessPenalty(loanId: string) {
    setActionError(null);
    try {
      await api.assessLoanPenalty(cooperativeId, loanId);
      setAllLoans(await api.listLoansForCooperative(cooperativeId));
      await refreshLoanDetail(loanId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  function renderLoanDetail(loan: Loan, { canManage, isOwnLoan }: { canManage: boolean; isOwnLoan: boolean }) {
    const detail = loanDetails[loan.id];
    const repayment = repaymentDrafts[loan.id] ?? { amount: "", narration: "" };
    return (
      <div className="mt-2 space-y-3 border-t border-black/[.08] pt-2 text-xs dark:border-white/[.145]">
        {!detail && <p className="text-zinc-500">Loading…</p>}
        {detail && (
          <>
            {detail.guarantors && (
              <div>
                <p className="font-medium text-zinc-600 dark:text-zinc-400">Guarantors</p>
                <ul className="space-y-0.5">
                  {detail.guarantors.map((g) => (
                    <li key={g.id}>
                      {g.guarantorUser?.firstName} {g.guarantorUser?.lastName} — {g.status}
                    </li>
                  ))}
                  {detail.guarantors.length === 0 && <li className="text-zinc-500">None nominated yet.</li>}
                </ul>
                {loan.status === "PENDING" && isOwnLoan && (
                  <div className="mt-1 flex gap-2">
                    <input
                      className="flex-1 rounded-md border border-black/[.08] bg-transparent px-2 py-1 dark:border-white/[.145]"
                      placeholder="Guarantor email"
                      value={guarantorEmailDrafts[loan.id] ?? ""}
                      onChange={(e) =>
                        setGuarantorEmailDrafts((prev) => ({ ...prev, [loan.id]: e.target.value }))
                      }
                    />
                    <button
                      onClick={() => onAddGuarantor(loan.id)}
                      className="rounded-full border border-black/[.08] px-3 py-1 font-medium dark:border-white/[.145]"
                    >
                      Nominate
                    </button>
                  </div>
                )}
              </div>
            )}
            {detail.schedule && detail.schedule.length > 0 && (
              <div>
                <p className="font-medium text-zinc-600 dark:text-zinc-400">Repayment schedule</p>
                <ul className="space-y-0.5">
                  {detail.schedule.map((i) => (
                    <li key={i.id} className="flex items-center justify-between">
                      <span>
                        #{i.installmentNumber} due {new Date(i.dueDate).toLocaleDateString()} —{" "}
                        {(Number(i.principalDue) + Number(i.interestDue)).toFixed(2)}
                      </span>
                      <span className={i.status === "OVERDUE" ? "text-red-600 dark:text-red-400" : "text-zinc-500"}>
                        {i.status}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {detail.ledger && detail.ledger.length > 0 && (
              <div>
                <p className="font-medium text-zinc-600 dark:text-zinc-400">Ledger</p>
                <ul className="space-y-0.5">
                  {detail.ledger.map((entry) => (
                    <li key={entry.id}>
                      {new Date(entry.createdAt).toLocaleDateString()} — {entry.type} {entry.amount} (bal{" "}
                      {entry.balanceAfter})
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {canManage && (
              <div className="flex flex-wrap items-center gap-2">
                {loan.status === "PENDING" && (
                  <>
                    <button
                      onClick={() => onApprove(loan.id)}
                      className="rounded-full border border-black/[.08] px-3 py-1 font-medium dark:border-white/[.145]"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onReject(loan.id)}
                      className="text-red-600 hover:underline dark:text-red-400"
                    >
                      Reject
                    </button>
                  </>
                )}
                {loan.status === "APPROVED" && (
                  <button
                    onClick={() => onDisburse(loan.id)}
                    className="rounded-full border border-black/[.08] px-3 py-1 font-medium dark:border-white/[.145]"
                  >
                    Disburse
                  </button>
                )}
                {loan.status === "ACTIVE" && (
                  <>
                    <input
                      className="w-24 rounded-md border border-black/[.08] bg-transparent px-2 py-1 dark:border-white/[.145]"
                      placeholder="Amount"
                      value={repayment.amount}
                      onChange={(e) =>
                        setRepaymentDrafts((prev) => ({
                          ...prev,
                          [loan.id]: { ...repayment, amount: e.target.value },
                        }))
                      }
                    />
                    <input
                      className="flex-1 rounded-md border border-black/[.08] bg-transparent px-2 py-1 dark:border-white/[.145]"
                      placeholder="Narration"
                      value={repayment.narration}
                      onChange={(e) =>
                        setRepaymentDrafts((prev) => ({
                          ...prev,
                          [loan.id]: { ...repayment, narration: e.target.value },
                        }))
                      }
                    />
                    <button
                      onClick={() => onRecordRepayment(loan.id)}
                      className="rounded-full border border-black/[.08] px-3 py-1 font-medium dark:border-white/[.145]"
                    >
                      Record repayment
                    </button>
                    <button
                      onClick={() => onAssessPenalty(loan.id)}
                      className="rounded-full border border-black/[.08] px-3 py-1 font-medium dark:border-white/[.145]"
                    >
                      Assess penalty
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    );
  }

  return (
    <>
      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Loan products</h2>
        <ErrorText message={productError} />
        <ul className="space-y-1 text-sm">
          {products.map((p) => (
            <li key={p.id} className="flex items-center justify-between">
              <span>
                {p.name} <span className="text-xs text-zinc-500">({p.code})</span>
              </span>
              <span className="text-xs text-zinc-500">
                {p.interestRatePercent}% · max ₦{p.maxAmount} / {p.maxTermMonths}mo · {p.requiredGuarantors}{" "}
                guarantor(s)
                {!p.isActive && " · inactive"}
              </span>
            </li>
          ))}
          {products.length === 0 && <li className="text-zinc-500 dark:text-zinc-500">No loan products yet.</li>}
        </ul>
        <form onSubmit={onCreateProduct} className="flex flex-wrap gap-2">
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Product name"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required
          />
          <input
            className="w-20 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Code"
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            required
          />
          <input
            className="w-20 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Rate %"
            value={productRate}
            onChange={(e) => setProductRate(e.target.value)}
          />
          <input
            className="w-28 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Max amount"
            value={productMaxAmount}
            onChange={(e) => setProductMaxAmount(e.target.value)}
            required
          />
          <input
            className="w-24 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Max months"
            value={productMaxTerm}
            onChange={(e) => setProductMaxTerm(e.target.value)}
            required
          />
          <input
            className="w-24 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Penalty %"
            value={productPenaltyRate}
            onChange={(e) => setProductPenaltyRate(e.target.value)}
          />
          <input
            className="w-24 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Guarantors"
            value={productRequiredGuarantors}
            onChange={(e) => setProductRequiredGuarantors(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Add
          </button>
        </form>
      </section>

      {guarantorRequests.length > 0 && (
        <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">Guarantor requests</h2>
          <ErrorText message={actionError} />
          <ul className="space-y-2 text-sm">
            {guarantorRequests.map((g) => (
              <li key={g.id} className="flex items-center justify-between">
                <span>
                  {g.loan?.membership?.user.firstName} {g.loan?.membership?.user.lastName} wants you to guarantee ₦
                  {g.loan?.principal} ({g.loan?.product?.name})
                </span>
                {g.status === "PENDING" ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onRespondGuarantorRequest(g.loanId, g.id, "APPROVED")}
                      className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onRespondGuarantorRequest(g.loanId, g.id, "DECLINED")}
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Decline
                    </button>
                  </div>
                ) : (
                  <span className={`text-xs ${statusColor(g.status)}`}>{g.status}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">My loans</h2>
        <ErrorText message={applyError} />
        <ul className="space-y-2 text-sm">
          {myLoans.map((loan) => (
            <li key={loan.id}>
              <div className="flex items-center justify-between">
                <span>
                  {loan.product?.name} · ₦{loan.principal} / {loan.termMonths}mo
                </span>
                <button onClick={() => onToggleExpand(loan.id)} className="flex items-center gap-2">
                  <span className={statusColor(loan.status)}>{loan.status}</span>
                  <span className="text-zinc-500">{expanded[loan.id] ? "Hide" : "Details"}</span>
                </button>
              </div>
              {expanded[loan.id] && renderLoanDetail(loan, { canManage: false, isOwnLoan: true })}
            </li>
          ))}
          {myLoans.length === 0 && <li className="text-zinc-500 dark:text-zinc-500">No loan applications yet.</li>}
        </ul>
        <form onSubmit={onApply} className="flex flex-wrap gap-2">
          <select
            className="rounded-md border border-black/[.08] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.145]"
            value={applyProductId}
            onChange={(e) => setApplyProductId(e.target.value)}
            required
          >
            <option value="">Product…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input
            className="w-28 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Principal"
            value={applyPrincipal}
            onChange={(e) => setApplyPrincipal(e.target.value)}
            required
          />
          <input
            className="w-24 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Months"
            value={applyTermMonths}
            onChange={(e) => setApplyTermMonths(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Apply
          </button>
        </form>
      </section>

      {allLoans && (
        <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">Loans</h2>
          <ErrorText message={actionError} />
          <ul className="space-y-2 text-sm">
            {allLoans.map((loan) => (
              <li key={loan.id}>
                <div className="flex items-center justify-between">
                  <span>
                    {loan.membership?.user.firstName} {loan.membership?.user.lastName} — {loan.product?.name} · ₦
                    {loan.principal}
                  </span>
                  <button onClick={() => onToggleExpand(loan.id)} className="flex items-center gap-2">
                    <span className={statusColor(loan.status)}>{loan.status}</span>
                    <span className="text-zinc-500">bal ₦{loan.outstandingBalance}</span>
                    <span className="text-zinc-500">{expanded[loan.id] ? "Hide" : "Manage"}</span>
                  </button>
                </div>
                {expanded[loan.id] &&
                  renderLoanDetail(loan, { canManage: true, isOwnLoan: loan.membership?.user.id === me?.id })}
              </li>
            ))}
            {allLoans.length === 0 && <li className="text-zinc-500 dark:text-zinc-500">No loans yet.</li>}
          </ul>
        </section>
      )}
    </>
  );
}
