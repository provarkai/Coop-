"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  ApiError,
  getAccessToken,
  type AuthUser,
  type ComplianceCooperative,
  type ComplianceFiling,
  type DashboardSummary,
  type Meeting,
  type RegulatorAssignment,
} from "@/lib/api";

const STATUS_FILTERS = ["ALL", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"];

function formatNaira(amount: string) {
  const value = Number(amount);
  return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function RegulatorPage() {
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [cooperatives, setCooperatives] = useState<ComplianceCooperative[] | null>(null);
  const [filings, setFilings] = useState<ComplianceFiling[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Only fetched on demand, per cooperative, when its card is expanded --
  // the default view is just the collapsed report/dashboard summary.
  const [expanded, setExpanded] = useState<string | null>(null);
  const [standing, setStanding] = useState<Record<string, DashboardSummary>>({});
  const [meetings, setMeetings] = useState<Record<string, Meeting[]>>({});
  const [assignments, setAssignments] = useState<Record<string, RegulatorAssignment[]>>({});
  const [drillError, setDrillError] = useState<string | null>(null);
  const [assignEmail, setAssignEmail] = useState<Record<string, string>>({});
  const [assignError, setAssignError] = useState<string | null>(null);

  async function loadFilings(status: string) {
    setFilings(await api.listAllFilings(status === "ALL" ? undefined : status));
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    async function load() {
      try {
        const [coops] = await Promise.all([
          api.listAllCooperativesForCompliance(),
          loadFilings(statusFilter),
          api.me().then(setMe),
        ]);
        setCooperatives(coops);
      } catch (err) {
        setError(
          err instanceof ApiError && err.status === 403
            ? "You don't have regulator access on this platform."
            : err instanceof ApiError
              ? err.message
              : "Something went wrong",
        );
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  async function onFilterChange(status: string) {
    setStatusFilter(status);
    try {
      await loadFilings(status);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onReview(filingId: string, status: "APPROVED" | "REJECTED") {
    setActionError(null);
    try {
      await api.reviewFiling(filingId, status, notes[filingId]);
      await loadFilings(statusFilter);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onToggleExpand(cooperativeId: string) {
    setDrillError(null);
    if (expanded === cooperativeId) {
      setExpanded(null);
      return;
    }
    setExpanded(cooperativeId);
    try {
      if (!standing[cooperativeId] || !meetings[cooperativeId]) {
        const [dashboard, meetingList] = await Promise.all([
          api.getFinancialStanding(cooperativeId),
          api.getRegulatorMeetings(cooperativeId),
        ]);
        setStanding((prev) => ({ ...prev, [cooperativeId]: dashboard }));
        setMeetings((prev) => ({ ...prev, [cooperativeId]: meetingList }));
      }
      if (me?.role === "SUPER_ADMIN" && !assignments[cooperativeId]) {
        const list = await api.listRegulatorAssignments(cooperativeId);
        setAssignments((prev) => ({ ...prev, [cooperativeId]: list }));
      }
    } catch (err) {
      setDrillError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onAssign(cooperativeId: string) {
    setAssignError(null);
    const email = assignEmail[cooperativeId];
    if (!email) return;
    try {
      await api.assignRegulator(cooperativeId, email);
      setAssignEmail((prev) => ({ ...prev, [cooperativeId]: "" }));
      const list = await api.listRegulatorAssignments(cooperativeId);
      setAssignments((prev) => ({ ...prev, [cooperativeId]: list }));
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onUnassign(cooperativeId: string, assignmentId: string) {
    setAssignError(null);
    try {
      await api.unassignRegulator(assignmentId);
      const list = await api.listRegulatorAssignments(cooperativeId);
      setAssignments((prev) => ({ ...prev, [cooperativeId]: list }));
    } catch (err) {
      setAssignError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Link href="/dashboard" className="text-sm font-medium text-black dark:text-zinc-50">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!cooperatives) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/dashboard" className="text-sm font-medium text-black dark:text-zinc-50">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">Regulator dashboard</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-500">
            {me?.role === "SUPER_ADMIN"
              ? "Every cooperative on the platform"
              : "Cooperatives assigned to you"}
          </p>
        </div>
        {me?.role === "SUPER_ADMIN" && (
          <Link
            href="/cooperatives/new"
            className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            + Register cooperative
          </Link>
        )}
      </div>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Cooperatives ({cooperatives.length})</h2>
        {drillError && <p className="text-sm text-red-600 dark:text-red-400">{drillError}</p>}
        <ul className="divide-y divide-black/[.08] dark:divide-white/[.145]">
          {cooperatives.map((c) => (
            <li key={c.id} className="space-y-3 py-3 text-sm">
              <button
                onClick={() => onToggleExpand(c.id)}
                className="flex w-full items-center justify-between text-left"
              >
                <span>
                  <strong>{c.name}</strong> <span className="text-xs text-zinc-500">/{c.slug}</span>
                  {c.state && <span className="ml-2 text-xs text-zinc-500">· {c.state}</span>}
                </span>
                <span className="text-xs text-zinc-500">
                  {c._count.memberships} members · {c._count.complianceFilings} filings{" "}
                  {expanded === c.id ? "▲" : "▼"}
                </span>
              </button>

              {expanded === c.id && (
                <div className="space-y-4 rounded-lg bg-zinc-50 p-4 dark:bg-black/40">
                  {!standing[c.id] || !meetings[c.id] ? (
                    <p className="text-xs text-zinc-500">Loading…</p>
                  ) : (
                    <>
                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                          Financial standing
                        </h3>
                        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                          <div>
                            <div className="text-zinc-500">Active members</div>
                            <div className="font-medium text-black dark:text-zinc-50">
                              {standing[c.id].activeMembers}
                            </div>
                          </div>
                          <div>
                            <div className="text-zinc-500">Total savings</div>
                            <div className="font-medium text-black dark:text-zinc-50">
                              {formatNaira(standing[c.id].totalSavingsBalance)}
                            </div>
                          </div>
                          <div>
                            <div className="text-zinc-500">Outstanding loans</div>
                            <div className="font-medium text-black dark:text-zinc-50">
                              {formatNaira(standing[c.id].totalOutstandingLoans)}
                            </div>
                          </div>
                          <div>
                            <div className="text-zinc-500">Cash balance</div>
                            <div className="font-medium text-black dark:text-zinc-50">
                              {formatNaira(standing[c.id].cashBalance)}
                            </div>
                          </div>
                          <div>
                            <div className="text-zinc-500">Net surplus</div>
                            <div className="font-medium text-black dark:text-zinc-50">
                              {formatNaira(standing[c.id].netSurplus)}
                            </div>
                          </div>
                          <div>
                            <div className="text-zinc-500">Open resolutions</div>
                            <div className="font-medium text-black dark:text-zinc-50">
                              {standing[c.id].openResolutions}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">Meetings</h3>
                        {meetings[c.id].length === 0 ? (
                          <p className="text-xs text-zinc-500">No meetings recorded.</p>
                        ) : (
                          <ul className="space-y-1 text-xs">
                            {meetings[c.id].slice(0, 5).map((m) => (
                              <li key={m.id} className="flex items-center justify-between">
                                <span>
                                  {m.title} <span className="text-zinc-500">({m.type})</span>
                                </span>
                                <span className="text-zinc-500">
                                  {new Date(m.scheduledAt).toLocaleDateString()} · {m.status}
                                </span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )}

                  {me?.role === "SUPER_ADMIN" && (
                    <div>
                      <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                        Regulator assignments
                      </h3>
                      {assignError && (
                        <p className="mb-1 text-xs text-red-600 dark:text-red-400">{assignError}</p>
                      )}
                      <ul className="mb-2 space-y-1 text-xs">
                        {(assignments[c.id] ?? []).map((a) => (
                          <li key={a.id} className="flex items-center justify-between">
                            <span>{a.regulator?.email ?? a.regulatorUserId}</span>
                            <button
                              onClick={() => onUnassign(c.id, a.id)}
                              className="text-red-600 hover:underline dark:text-red-400"
                            >
                              Remove
                            </button>
                          </li>
                        ))}
                        {(assignments[c.id] ?? []).length === 0 && (
                          <li className="text-zinc-500">No regulators assigned yet.</li>
                        )}
                      </ul>
                      <div className="flex gap-2">
                        <input
                          className="flex-1 rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
                          placeholder="regulator@example.com"
                          value={assignEmail[c.id] ?? ""}
                          onChange={(e) =>
                            setAssignEmail((prev) => ({ ...prev, [c.id]: e.target.value }))
                          }
                        />
                        <button
                          onClick={() => onAssign(c.id)}
                          className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
                        >
                          Assign
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-black dark:text-zinc-50">Compliance filings</h2>
          <select
            className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
            value={statusFilter}
            onChange={(e) => onFilterChange(e.target.value)}
          >
            {STATUS_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {actionError && <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}

        <ul className="space-y-3">
          {filings.map((f) => (
            <li key={f.id} className="space-y-1 border-b border-black/[.08] pb-3 text-sm last:border-0 dark:border-white/[.145]">
              <div className="flex items-center justify-between">
                <span>
                  <strong>{f.cooperative?.name}</strong> — {f.title}{" "}
                  <span className="text-xs text-zinc-500">
                    ({f.type} · {f.period})
                  </span>
                </span>
                <span className="text-xs text-zinc-500">{f.status}</span>
              </div>
              {(f.status === "SUBMITTED" || f.status === "UNDER_REVIEW") && (
                <div className="flex gap-2">
                  <input
                    className="flex-1 rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
                    placeholder="Review notes (optional)"
                    value={notes[f.id] ?? ""}
                    onChange={(e) => setNotes((prev) => ({ ...prev, [f.id]: e.target.value }))}
                  />
                  <button
                    onClick={() => onReview(f.id, "APPROVED")}
                    className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => onReview(f.id, "REJECTED")}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Reject
                  </button>
                </div>
              )}
            </li>
          ))}
          {filings.length === 0 && <li className="text-zinc-500 dark:text-zinc-500">No filings.</li>}
        </ul>
      </section>
    </div>
  );
}
