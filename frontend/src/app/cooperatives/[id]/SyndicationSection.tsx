"use client";

import { useEffect, useState, type FormEvent } from "react";
import { api, ApiError, type Syndication } from "@/lib/api";

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

function statusColor(status: string) {
  if (status === "COMPLETED" || status === "RELEASED" || status === "VERIFIED") {
    return "text-green-600 dark:text-green-400";
  }
  if (status === "CANCELLED") return "text-red-600 dark:text-red-400";
  return "text-amber-600 dark:text-amber-400";
}

export default function SyndicationSection({
  cooperativeId,
  active,
}: {
  cooperativeId: string;
  active: boolean;
}) {
  const [syndications, setSyndications] = useState<Syndication[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Syndication | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [escrowPartnerRef, setEscrowPartnerRef] = useState("");
  const [escrowAmount, setEscrowAmount] = useState("");
  const [allocationEmail, setAllocationEmail] = useState("");
  const [allocationPlotRef, setAllocationPlotRef] = useState("");

  useEffect(() => {
    if (!active) return;
    api
      .listSyndications(cooperativeId)
      .then(setSyndications)
      .catch(() => {});
  }, [cooperativeId, active]);

  async function loadDetail(id: string) {
    setDetail(await api.getSyndication(cooperativeId, id));
  }

  async function onToggleExpand(id: string) {
    setActionError(null);
    if (expandedId === id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(id);
    try {
      await loadDetail(id);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onFundEscrow(e: FormEvent) {
    e.preventDefault();
    if (!expandedId) return;
    setActionError(null);
    try {
      await api.fundEscrow(cooperativeId, expandedId, {
        escrowPartnerRef,
        amount: Number(escrowAmount),
      });
      setEscrowPartnerRef("");
      setEscrowAmount("");
      await loadDetail(expandedId);
      setSyndications(await api.listSyndications(cooperativeId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onVerifyMilestone(milestoneId: string) {
    if (!expandedId) return;
    setActionError(null);
    try {
      await api.verifyMilestone(cooperativeId, expandedId, milestoneId);
      await loadDetail(expandedId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onReleaseMilestone(milestoneId: string) {
    if (!expandedId) return;
    setActionError(null);
    try {
      await api.releaseMilestone(cooperativeId, expandedId, milestoneId);
      await loadDetail(expandedId);
      setSyndications(await api.listSyndications(cooperativeId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onRecordAllocation(e: FormEvent) {
    e.preventDefault();
    if (!expandedId) return;
    setActionError(null);
    try {
      await api.recordAllocation(cooperativeId, expandedId, {
        memberEmail: allocationEmail,
        plotRef: allocationPlotRef,
      });
      setAllocationEmail("");
      setAllocationPlotRef("");
      await loadDetail(expandedId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
      <h2 className="font-semibold text-black dark:text-zinc-50">Property syndication</h2>
      <p className="text-xs text-zinc-500">
        Kesa coordinates and documents each purchase; it never holds the pooled funds itself -- escrow is a
        simulated record of an external licensed trustee, the same convention the Payments module uses.
      </p>
      <ErrorText message={actionError} />

      <ul className="divide-y divide-black/[.08] dark:divide-white/[.145]">
        {syndications.map((s) => (
          <li key={s.id} className="space-y-3 py-3 text-sm">
            <button
              onClick={() => onToggleExpand(s.id)}
              className="flex w-full items-center justify-between text-left"
            >
              <span>
                <strong>{s.parcel?.location}</strong>{" "}
                <span className="text-xs text-zinc-500">({s.group?.name})</span>
              </span>
              <span className={`text-xs ${statusColor(s.status)}`}>{s.status}</span>
            </button>

            {expandedId === s.id && detail && (
              <div className="space-y-4 rounded-lg bg-zinc-50 p-4 dark:bg-black/40">
                {detail.escrowPartnerRef && (
                  <p className="text-xs text-zinc-500">
                    Escrow: {detail.escrowPartnerRef} · ₦{detail.totalEscrowed}
                  </p>
                )}

                {detail.status === "ESCROW_PENDING" && (
                  <form onSubmit={onFundEscrow} className="flex flex-wrap gap-2">
                    <input
                      className="flex-1 rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
                      placeholder="Trustee/escrow partner reference"
                      value={escrowPartnerRef}
                      onChange={(e) => setEscrowPartnerRef(e.target.value)}
                      required
                    />
                    <input
                      className="w-28 rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
                      placeholder="Amount"
                      value={escrowAmount}
                      onChange={(e) => setEscrowAmount(e.target.value)}
                      required
                    />
                    <button className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]">
                      Fund escrow
                    </button>
                  </form>
                )}

                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">Milestones</h3>
                  <ul className="space-y-2 text-xs">
                    {detail.milestones?.map((m) => (
                      <li key={m.id} className="flex items-center justify-between">
                        <span>
                          {m.order}. {m.name} · ₦{m.releaseAmount}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className={statusColor(m.status)}>{m.status}</span>
                          {m.status === "PENDING" && (
                            <button
                              onClick={() => onVerifyMilestone(m.id)}
                              className="rounded-full border border-black/[.08] px-2 py-0.5 dark:border-white/[.145]"
                            >
                              Verify
                            </button>
                          )}
                          {m.status === "VERIFIED" && (
                            <button
                              onClick={() => onReleaseMilestone(m.id)}
                              className="rounded-full border border-black/[.08] px-2 py-0.5 dark:border-white/[.145]"
                            >
                              Release
                            </button>
                          )}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div>
                  <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">
                    Allocations (document vault)
                  </h3>
                  <ul className="space-y-1 text-xs">
                    {detail.allocations?.map((a) => (
                      <li key={a.id}>
                        {a.membership?.user.firstName} {a.membership?.user.lastName} · {a.plotRef}
                      </li>
                    ))}
                    {(!detail.allocations || detail.allocations.length === 0) && (
                      <li className="text-zinc-500">No allocations recorded yet.</li>
                    )}
                  </ul>
                  {detail.status === "COMPLETED" && (
                    <form onSubmit={onRecordAllocation} className="mt-2 flex flex-wrap gap-2">
                      <input
                        className="flex-1 rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
                        placeholder="Member email"
                        type="email"
                        value={allocationEmail}
                        onChange={(e) => setAllocationEmail(e.target.value)}
                        required
                      />
                      <input
                        className="w-28 rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
                        placeholder="Plot ref"
                        value={allocationPlotRef}
                        onChange={(e) => setAllocationPlotRef(e.target.value)}
                        required
                      />
                      <button className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]">
                        Record allocation
                      </button>
                    </form>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
        {syndications.length === 0 && (
          <li className="py-3 text-sm text-zinc-500">
            No syndications yet -- these start once a group&apos;s reservation is confirmed on the Land Banking tab.
          </li>
        )}
      </ul>
    </section>
  );
}
