"use client";

import { useEffect, useState } from "react";
import {
  api,
  ApiError,
  downloadFile,
  saveBlob,
  type DashboardSummary,
  type FraudAlert,
  type TrendPoint,
} from "@/lib/api";

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

function Tile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-black/[.06] p-3 dark:border-white/[.1]">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-lg font-semibold text-black dark:text-zinc-50">{value}</p>
    </div>
  );
}

function MiniBarChart({
  label,
  points,
  signed = false,
}: {
  label: string;
  points: { month: string; value: number }[];
  signed?: boolean;
}) {
  const max = Math.max(1, ...points.map((p) => Math.abs(p.value)));
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">{label}</p>
      <div className="flex h-16 items-end gap-1">
        {points.map((p) => {
          const heightPct = Math.max((Math.abs(p.value) / max) * 100, 2);
          const negative = signed && p.value < 0;
          return (
            <div key={p.month} className="flex flex-1 flex-col items-center justify-end gap-1">
              <div
                className={`w-full rounded-t ${negative ? "bg-red-500/70" : "bg-zinc-700 dark:bg-zinc-300"}`}
                style={{ height: `${heightPct}%` }}
              />
              <span className="text-[10px] text-zinc-500">{p.month.slice(5)}</span>
            </div>
          );
        })}
      </div>
      <p className="text-[11px] text-zinc-500">
        {points.map((p) => `${p.month}: ${p.value.toLocaleString()}`).join(" · ")}
      </p>
    </div>
  );
}

export default function ReportsSection({ cooperativeId }: { cooperativeId: string }) {
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [trends, setTrends] = useState<TrendPoint[]>([]);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState<string | null>(null);

  async function reload() {
    try {
      const [dash, trendData] = await Promise.all([
        api.getDashboard(cooperativeId),
        api.getDashboardTrends(cooperativeId, 6),
      ]);
      setDashboard(dash);
      setTrends(trendData);
    } catch {
      setDashboard(null);
    }
    // Fraud alerts are gated to a narrower role set (admin/chairman/auditor)
    // than the dashboard itself, so a 403 here shouldn't blank the dashboard.
    try {
      setFraudAlerts(await api.getFraudAlerts(cooperativeId));
    } catch {
      setFraudAlerts(null);
    }
  }

  useEffect(() => {
    async function load() {
      try {
        await reload();
      } catch {
        setDashboard(null);
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cooperativeId]);

  async function onExport(kind: "members" | "savings-transactions" | "loans" | "journal-entries") {
    setError(null);
    try {
      const blob = await downloadFile(`/cooperatives/${cooperativeId}/exports/${kind}.csv`);
      saveBlob(blob, `${kind}.csv`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onGenerateDigest() {
    setError(null);
    setGeneratedMessage(null);
    setGenerating(true);
    try {
      const doc = await api.generateMonthlyDigest(cooperativeId);
      setGeneratedMessage(`"${doc.title}" generated — find it under Documents to download.`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setGenerating(false);
    }
  }

  if (!dashboard) return null;

  return (
    <section className="space-y-4 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
      <h2 className="font-semibold text-black dark:text-zinc-50">Reports & dashboard</h2>
      <ErrorText message={error} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <Tile label="Active members" value={dashboard.activeMembers} />
        <Tile label="Pending applications" value={dashboard.pendingApplications} />
        <Tile label="Total savings" value={`₦${dashboard.totalSavingsBalance}`} />
        <Tile label="Outstanding loans" value={`₦${dashboard.totalOutstandingLoans}`} />
        <Tile label="Cash balance" value={`₦${dashboard.cashBalance}`} />
        <Tile label="Net surplus" value={`₦${dashboard.netSurplus}`} />
        <Tile label="Upcoming meetings" value={dashboard.upcomingMeetings} />
        <Tile label="Open resolutions" value={dashboard.openResolutions} />
      </div>

      <div className="grid grid-cols-1 gap-4 border-t border-black/[.08] pt-4 sm:grid-cols-2 dark:border-white/[.145]">
        <MiniBarChart
          label="Savings net (deposits − withdrawals)"
          signed
          points={trends.map((t) => ({ month: t.month, value: Number(t.savingsNet) }))}
        />
        <MiniBarChart
          label="Loans disbursed"
          points={trends.map((t) => ({ month: t.month, value: Number(t.loanDisbursed) }))}
        />
        <MiniBarChart
          label="Loan repayments"
          points={trends.map((t) => ({ month: t.month, value: Number(t.loanRepaid) }))}
        />
        <MiniBarChart
          label="New members"
          points={trends.map((t) => ({ month: t.month, value: t.newMembers }))}
        />
      </div>

      {fraudAlerts && (
        <div className="border-t border-black/[.08] pt-4 dark:border-white/[.145]">
          <h3 className="text-sm font-medium text-black dark:text-zinc-50">Fraud alerts (last 30 days)</h3>
          <ul className="space-y-1 pt-1 text-xs">
            {fraudAlerts.map((f, i) => (
              <li key={i} className="flex items-center justify-between">
                <span className="text-red-600 dark:text-red-400">
                  {f.type} — {f.member} ({f.accountNumber})
                </span>
                <span className="text-zinc-500">{f.description}</span>
              </li>
            ))}
            {fraudAlerts.length === 0 && <li className="text-zinc-500">No signals detected.</li>}
          </ul>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-black/[.08] pt-4 dark:border-white/[.145]">
        <button
          type="button"
          onClick={() => void onExport("members")}
          className="rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium dark:border-white/[.145]"
        >
          Export members CSV
        </button>
        <button
          type="button"
          onClick={() => void onExport("savings-transactions")}
          className="rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium dark:border-white/[.145]"
        >
          Export savings CSV
        </button>
        <button
          type="button"
          onClick={() => void onExport("loans")}
          className="rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium dark:border-white/[.145]"
        >
          Export loans CSV
        </button>
        <button
          type="button"
          onClick={() => void onExport("journal-entries")}
          className="rounded-full border border-black/[.08] px-3 py-1.5 text-xs font-medium dark:border-white/[.145]"
        >
          Export journal entries CSV
        </button>
        <button
          type="button"
          disabled={generating}
          onClick={() => void onGenerateDigest()}
          className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
        >
          {generating ? "Generating…" : "Generate report now"}
        </button>
      </div>
      {generatedMessage && <p className="text-sm text-green-600 dark:text-green-400">{generatedMessage}</p>}
    </section>
  );
}
