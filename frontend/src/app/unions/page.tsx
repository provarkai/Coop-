"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  ApiError,
  getAccessToken,
  type AuthUser,
  type ComplianceCooperative,
  type Union,
  type UnionAssignment,
  type UnionDashboard,
  type UnionDetail,
} from "@/lib/api";

function formatNaira(amount: string) {
  const value = Number(amount);
  return `₦${value.toLocaleString("en-NG", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export default function UnionsPage() {
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [unions, setUnions] = useState<Union[] | null>(null);
  const [allCooperatives, setAllCooperatives] = useState<ComplianceCooperative[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, UnionDetail>>({});
  const [dashboard, setDashboard] = useState<Record<string, UnionDashboard>>({});
  const [assignments, setAssignments] = useState<Record<string, UnionAssignment[]>>({});
  const [drillError, setDrillError] = useState<string | null>(null);

  const [attachCooperativeId, setAttachCooperativeId] = useState<Record<string, string>>({});
  const [assignEmail, setAssignEmail] = useState<Record<string, string>>({});
  const [actionError, setActionError] = useState<string | null>(null);

  async function reloadUnions() {
    setUnions(await api.listUnions());
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    async function load() {
      try {
        const user = await api.me();
        setMe(user);
        await reloadUnions();
        if (user.role === "SUPER_ADMIN") {
          setAllCooperatives(await api.listAllCooperativesForCompliance());
        }
      } catch (err) {
        setError(
          err instanceof ApiError && err.status === 403
            ? "You don't have union oversight access on this platform."
            : err instanceof ApiError
              ? err.message
              : "Something went wrong",
        );
      }
    }
    void load();
     
  }, [router]);

  async function onCreateUnion(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await api.createUnion({ name, slug, description: description || undefined });
      setName("");
      setSlug("");
      setDescription("");
      await reloadUnions();
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function loadDrilldown(unionId: string) {
    const [d, dash] = await Promise.all([
      api.getUnion(unionId),
      api.getUnionDashboard(unionId),
    ]);
    setDetail((prev) => ({ ...prev, [unionId]: d }));
    setDashboard((prev) => ({ ...prev, [unionId]: dash }));
    if (me?.role === "SUPER_ADMIN") {
      setAssignments((prev) => ({ ...prev, [unionId]: [] }));
      const list = await api.listUnionAssignments(unionId);
      setAssignments((prev) => ({ ...prev, [unionId]: list }));
    }
  }

  async function onToggleExpand(unionId: string) {
    setDrillError(null);
    if (expanded === unionId) {
      setExpanded(null);
      return;
    }
    setExpanded(unionId);
    try {
      await loadDrilldown(unionId);
    } catch (err) {
      setDrillError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onAttachCooperative(unionId: string) {
    setActionError(null);
    const cooperativeId = attachCooperativeId[unionId];
    if (!cooperativeId) return;
    try {
      await api.addCooperativeToUnion(unionId, cooperativeId);
      setAttachCooperativeId((prev) => ({ ...prev, [unionId]: "" }));
      await loadDrilldown(unionId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onDetachCooperative(unionId: string, cooperativeId: string) {
    setActionError(null);
    try {
      await api.removeCooperativeFromUnion(unionId, cooperativeId);
      await loadDrilldown(unionId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onAssignUnionAdmin(unionId: string) {
    setActionError(null);
    const email = assignEmail[unionId];
    if (!email) return;
    try {
      await api.assignUnionAdmin(unionId, email);
      setAssignEmail((prev) => ({ ...prev, [unionId]: "" }));
      setAssignments((prev) => ({ ...prev, [unionId]: [] }));
      const list = await api.listUnionAssignments(unionId);
      setAssignments((prev) => ({ ...prev, [unionId]: list }));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onUnassignUnionAdmin(unionId: string, assignmentId: string) {
    setActionError(null);
    try {
      await api.unassignUnionAdmin(unionId, assignmentId);
      const list = await api.listUnionAssignments(unionId);
      setAssignments((prev) => ({ ...prev, [unionId]: list }));
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

  if (!unions) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl flex-1 space-y-6 bg-zinc-50 px-4 py-10 dark:bg-black">
      <div>
        <Link href="/dashboard" className="text-sm font-medium text-black dark:text-zinc-50">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">Union oversight</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          {me?.role === "SUPER_ADMIN"
            ? "Every union (federation/apex body) on the platform"
            : "Unions assigned to you"}
        </p>
      </div>

      {me?.role === "SUPER_ADMIN" && (
        <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">Create a union</h2>
          {createError && <p className="text-sm text-red-600 dark:text-red-400">{createError}</p>}
          <form onSubmit={onCreateUnion} className="flex flex-wrap gap-2">
            <input
              className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
              placeholder="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <input
              className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
              placeholder="slug-like-this"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              required
            />
            <input
              className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
              placeholder="Description (optional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              type="submit"
              className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Create
            </button>
          </form>
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Unions ({unions.length})</h2>
        {drillError && <p className="text-sm text-red-600 dark:text-red-400">{drillError}</p>}
        {actionError && <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}
        <ul className="divide-y divide-black/[.08] dark:divide-white/[.145]">
          {unions.map((u) => {
            const d = detail[u.id];
            const dash = dashboard[u.id];
            const attachableCooperatives = allCooperatives.filter(
              (c) => !d?.cooperatives.some((mc) => mc.id === c.id),
            );
            return (
              <li key={u.id} className="space-y-3 py-3 text-sm">
                <button
                  onClick={() => onToggleExpand(u.id)}
                  className="flex w-full items-center justify-between text-left"
                >
                  <span>
                    <strong>{u.name}</strong> <span className="text-xs text-zinc-500">/{u.slug}</span>
                  </span>
                  <span className="text-xs text-zinc-500">
                    {dash ? `${dash.cooperativeCount} cooperatives` : ""} {expanded === u.id ? "▲" : "▼"}
                  </span>
                </button>

                {expanded === u.id && (
                  <div className="space-y-4 rounded-lg bg-zinc-50 p-4 dark:bg-black/40">
                    {u.description && (
                      <p className="text-xs text-zinc-500">{u.description}</p>
                    )}
                    {!d || !dash ? (
                      <p className="text-xs text-zinc-500">Loading…</p>
                    ) : (
                      <>
                        <div>
                          <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                            Roll-up across {dash.cooperativeCount} cooperative(s)
                          </h3>
                          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
                            <div>
                              <div className="text-zinc-500">Active members</div>
                              <div className="font-medium text-black dark:text-zinc-50">
                                {dash.activeMembers}
                              </div>
                            </div>
                            <div>
                              <div className="text-zinc-500">Pending applications</div>
                              <div className="font-medium text-black dark:text-zinc-50">
                                {dash.pendingApplications}
                              </div>
                            </div>
                            <div>
                              <div className="text-zinc-500">Total savings</div>
                              <div className="font-medium text-black dark:text-zinc-50">
                                {formatNaira(dash.totalSavingsBalance)}
                              </div>
                            </div>
                            <div>
                              <div className="text-zinc-500">Outstanding loans</div>
                              <div className="font-medium text-black dark:text-zinc-50">
                                {formatNaira(dash.totalOutstandingLoans)}
                              </div>
                            </div>
                            <div>
                              <div className="text-zinc-500">Loans disbursed this month</div>
                              <div className="font-medium text-black dark:text-zinc-50">
                                {formatNaira(dash.loansDisbursedThisMonth)}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div>
                          <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                            Member cooperatives
                          </h3>
                          {dash.cooperatives.length === 0 ? (
                            <p className="text-xs text-zinc-500">No cooperatives in this union yet.</p>
                          ) : (
                            <ul className="space-y-1 text-xs">
                              {dash.cooperatives.map((c) => (
                                <li key={c.id} className="flex items-center justify-between">
                                  <Link href={`/cooperatives/${c.id}`} className="hover:underline">
                                    {c.name}
                                  </Link>
                                  <span className="text-zinc-500">
                                    {c.activeMembers} members · {formatNaira(c.totalSavingsBalance)} savings ·{" "}
                                    {formatNaira(c.totalOutstandingLoans)} loans
                                    {me?.role === "SUPER_ADMIN" && (
                                      <button
                                        onClick={() => onDetachCooperative(u.id, c.id)}
                                        className="ml-2 text-red-600 hover:underline dark:text-red-400"
                                      >
                                        Remove
                                      </button>
                                    )}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        {me?.role === "SUPER_ADMIN" && (
                          <>
                            <div>
                              <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                                Attach a cooperative
                              </h3>
                              <div className="flex gap-2">
                                <select
                                  className="flex-1 rounded-md border border-black/[.08] bg-white dark:bg-zinc-900 px-2 py-1 text-xs dark:border-white/[.145]"
                                  value={attachCooperativeId[u.id] ?? ""}
                                  onChange={(e) =>
                                    setAttachCooperativeId((prev) => ({ ...prev, [u.id]: e.target.value }))
                                  }
                                >
                                  <option value="">Choose a cooperative…</option>
                                  {attachableCooperatives.map((c) => (
                                    <option key={c.id} value={c.id}>
                                      {c.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  onClick={() => onAttachCooperative(u.id)}
                                  disabled={!attachCooperativeId[u.id]}
                                  className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-black/[.04] disabled:opacity-40 dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
                                >
                                  Attach
                                </button>
                              </div>
                            </div>

                            <div>
                              <h3 className="mb-2 text-xs font-semibold uppercase text-zinc-500">
                                Union admins
                              </h3>
                              <ul className="mb-2 space-y-1 text-xs">
                                {(assignments[u.id] ?? []).map((a) => (
                                  <li key={a.id} className="flex items-center justify-between">
                                    <span>{a.unionAdmin?.email ?? a.unionAdminUserId}</span>
                                    <button
                                      onClick={() => onUnassignUnionAdmin(u.id, a.id)}
                                      className="text-red-600 hover:underline dark:text-red-400"
                                    >
                                      Remove
                                    </button>
                                  </li>
                                ))}
                                {(assignments[u.id] ?? []).length === 0 && (
                                  <li className="text-zinc-500">No union admins assigned yet.</li>
                                )}
                              </ul>
                              <div className="flex gap-2">
                                <input
                                  className="flex-1 rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
                                  placeholder="union-admin@example.com"
                                  value={assignEmail[u.id] ?? ""}
                                  onChange={(e) =>
                                    setAssignEmail((prev) => ({ ...prev, [u.id]: e.target.value }))
                                  }
                                />
                                <button
                                  onClick={() => onAssignUnionAdmin(u.id)}
                                  className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
                                >
                                  Assign
                                </button>
                              </div>
                            </div>
                          </>
                        )}
                      </>
                    )}
                  </div>
                )}
              </li>
            );
          })}
          {unions.length === 0 && <li className="py-3 text-zinc-500 dark:text-zinc-500">No unions yet.</li>}
        </ul>
      </section>
    </div>
  );
}
