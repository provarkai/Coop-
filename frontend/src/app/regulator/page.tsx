"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, getAccessToken, type ComplianceCooperative, type ComplianceFiling } from "@/lib/api";

const STATUS_FILTERS = ["ALL", "SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"];

export default function RegulatorPage() {
  const router = useRouter();
  const [cooperatives, setCooperatives] = useState<ComplianceCooperative[] | null>(null);
  const [filings, setFilings] = useState<ComplianceFiling[]>([]);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

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
        const [coops] = await Promise.all([api.listAllCooperativesForCompliance(), loadFilings(statusFilter)]);
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
      <div>
        <Link href="/dashboard" className="text-sm font-medium text-black dark:text-zinc-50">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">Regulator dashboard</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">Cross-cooperative oversight</p>
      </div>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Cooperatives ({cooperatives.length})</h2>
        <ul className="space-y-1 text-sm">
          {cooperatives.map((c) => (
            <li key={c.id} className="flex items-center justify-between">
              <span>
                {c.name} <span className="text-xs text-zinc-500">/{c.slug}</span>
              </span>
              <span className="text-xs text-zinc-500">
                {c._count.memberships} members · {c._count.complianceFilings} filings
              </span>
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
