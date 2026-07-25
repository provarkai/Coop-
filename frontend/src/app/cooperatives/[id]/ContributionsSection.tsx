"use client";

import { useEffect, useState, type FormEvent } from "react";
import {
  api,
  ApiError,
  type Contribution,
  type ContributionFrequency,
  type ContributionGroup,
  type ContributionGroupType,
  type GroupTrustScore,
} from "@/lib/api";

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

function statusColor(status: string) {
  if (status === "CONFIRMED") return "text-green-600 dark:text-green-400";
  if (status === "DEFAULTED") return "text-red-600 dark:text-red-400";
  if (status === "LATE") return "text-amber-600 dark:text-amber-400";
  return "text-zinc-500";
}

export default function ContributionsSection({ cooperativeId }: { cooperativeId: string }) {
  const [groups, setGroups] = useState<ContributionGroup[]>([]);
  const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
  const [groupDetail, setGroupDetail] = useState<ContributionGroup | null>(null);
  const [contributions, setContributions] = useState<Contribution[]>([]);
  const [trustScore, setTrustScore] = useState<GroupTrustScore | null>(null);

  const [name, setName] = useState("");
  const [type, setType] = useState<ContributionGroupType>("TARGET");
  const [coordinatorEmail, setCoordinatorEmail] = useState("");
  const [contributionAmount, setContributionAmount] = useState("");
  const [frequency, setFrequency] = useState<ContributionFrequency>("MONTHLY");
  const [targetAmount, setTargetAmount] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  const [memberEmail, setMemberEmail] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listContributionGroups(cooperativeId)
      .then(setGroups)
      .catch(() => {});
  }, [cooperativeId]);

  async function loadGroupDetail(groupId: string) {
    const [detail, contributionList, score] = await Promise.all([
      api.getContributionGroup(cooperativeId, groupId),
      api.listContributions(cooperativeId, groupId),
      api.getGroupTrustScore(cooperativeId, groupId),
    ]);
    setGroupDetail(detail);
    setContributions(contributionList);
    setTrustScore(score);
  }

  async function onToggleExpand(groupId: string) {
    setActionError(null);
    if (expandedGroupId === groupId) {
      setExpandedGroupId(null);
      return;
    }
    setExpandedGroupId(groupId);
    try {
      await loadGroupDetail(groupId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onCreateGroup(e: FormEvent) {
    e.preventDefault();
    setCreateError(null);
    try {
      await api.createContributionGroup(cooperativeId, {
        name,
        type,
        coordinatorEmail,
        contributionAmount: Number(contributionAmount),
        frequency,
        ...(type === "TARGET" && targetAmount ? { targetAmount: Number(targetAmount) } : {}),
      });
      setName("");
      setCoordinatorEmail("");
      setContributionAmount("");
      setTargetAmount("");
      setGroups(await api.listContributionGroups(cooperativeId));
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onAddMember(e: FormEvent) {
    e.preventDefault();
    if (!expandedGroupId) return;
    setActionError(null);
    try {
      await api.addGroupMember(cooperativeId, expandedGroupId, memberEmail);
      setMemberEmail("");
      await loadGroupDetail(expandedGroupId);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onRecordPeriod(e: FormEvent) {
    e.preventDefault();
    if (!expandedGroupId) return;
    setActionError(null);
    try {
      await api.recordContributionPeriod(cooperativeId, expandedGroupId, {
        dueDate: new Date(dueDate).toISOString(),
      });
      setDueDate("");
      setContributions(await api.listContributions(cooperativeId, expandedGroupId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onConfirm(contributionId: string) {
    if (!expandedGroupId) return;
    setActionError(null);
    try {
      await api.confirmContribution(cooperativeId, expandedGroupId, contributionId);
      setContributions(await api.listContributions(cooperativeId, expandedGroupId));
      setTrustScore(await api.getGroupTrustScore(cooperativeId, expandedGroupId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onFlag(contributionId: string, status: "LATE" | "DEFAULTED") {
    if (!expandedGroupId) return;
    setActionError(null);
    try {
      await api.flagContribution(cooperativeId, expandedGroupId, contributionId, status);
      setContributions(await api.listContributions(cooperativeId, expandedGroupId));
      setTrustScore(await api.getGroupTrustScore(cooperativeId, expandedGroupId));
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  return (
    <>
      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">
          Contribution groups <span className="text-xs font-normal text-zinc-500">(Ajo/Esusu)</span>
        </h2>
        <ErrorText message={actionError} />
        <ul className="divide-y divide-black/[.08] dark:divide-white/[.145]">
          {groups.map((g) => (
            <li key={g.id} className="space-y-3 py-3 text-sm">
              <button
                onClick={() => onToggleExpand(g.id)}
                className="flex w-full items-center justify-between text-left"
              >
                <span>
                  <strong>{g.name}</strong>{" "}
                  <span className="text-xs text-zinc-500">
                    ({g.type} · {g.frequency} · {g._count?.members ?? 0} members)
                  </span>
                </span>
                <span className="text-xs text-zinc-500">{expandedGroupId === g.id ? "Hide" : "Details"}</span>
              </button>

              {expandedGroupId === g.id && groupDetail && (
                <div className="space-y-4 rounded-lg bg-zinc-50 p-4 dark:bg-black/40">
                  <div className="text-xs text-zinc-500">
                    Coordinator: {groupDetail.coordinatorMembership?.user.firstName}{" "}
                    {groupDetail.coordinatorMembership?.user.lastName} · ₦{groupDetail.contributionAmount} per period
                    {groupDetail.targetAmount && <> · target ₦{groupDetail.targetAmount}</>}
                  </div>

                  {trustScore && (
                    <div className="text-xs">
                      Group trust score: <strong>{trustScore.averageScore}</strong> ({trustScore.rating}) across{" "}
                      {trustScore.memberCount} members
                    </div>
                  )}

                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">Members</h3>
                    <ul className="space-y-1 text-xs">
                      {groupDetail.members?.map((m) => (
                        <li key={m.id}>
                          {m.membership.user.firstName} {m.membership.user.lastName}
                          {m.rotationOrder != null && <> · rotation #{m.rotationOrder}</>}
                        </li>
                      ))}
                    </ul>
                    <form onSubmit={onAddMember} className="mt-2 flex gap-2">
                      <input
                        className="flex-1 rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
                        placeholder="Member email"
                        type="email"
                        value={memberEmail}
                        onChange={(e) => setMemberEmail(e.target.value)}
                        required
                      />
                      <button className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]">
                        Add
                      </button>
                    </form>
                  </div>

                  <div>
                    <h3 className="mb-1 text-xs font-semibold uppercase text-zinc-500">Contributions</h3>
                    <ul className="space-y-1 text-xs">
                      {contributions.map((c) => (
                        <li key={c.id} className="flex items-center justify-between">
                          <span>
                            {c.membership?.user.firstName} {c.membership?.user.lastName} · ₦{c.amount} due{" "}
                            {new Date(c.dueDate).toLocaleDateString()}
                          </span>
                          <span className="flex items-center gap-2">
                            <span className={statusColor(c.status)}>{c.status}</span>
                            {c.status !== "CONFIRMED" && (
                              <>
                                <button
                                  onClick={() => onConfirm(c.id)}
                                  className="rounded-full border border-black/[.08] px-2 py-0.5 dark:border-white/[.145]"
                                >
                                  Confirm
                                </button>
                                <button
                                  onClick={() => onFlag(c.id, "LATE")}
                                  className="text-amber-600 hover:underline dark:text-amber-400"
                                >
                                  Late
                                </button>
                                <button
                                  onClick={() => onFlag(c.id, "DEFAULTED")}
                                  className="text-red-600 hover:underline dark:text-red-400"
                                >
                                  Default
                                </button>
                              </>
                            )}
                          </span>
                        </li>
                      ))}
                      {contributions.length === 0 && <li className="text-zinc-500">No periods recorded yet.</li>}
                    </ul>
                    <form onSubmit={onRecordPeriod} className="mt-2 flex gap-2">
                      <input
                        className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
                        type="date"
                        value={dueDate}
                        onChange={(e) => setDueDate(e.target.value)}
                        required
                      />
                      <button className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium dark:border-white/[.145]">
                        Record period for all members
                      </button>
                    </form>
                  </div>
                </div>
              )}
            </li>
          ))}
          {groups.length === 0 && <li className="py-3 text-sm text-zinc-500">No contribution groups yet.</li>}
        </ul>

        <form onSubmit={onCreateGroup} className="space-y-2 border-t border-black/[.08] pt-3 dark:border-white/[.145]">
          <ErrorText message={createError} />
          <div className="flex flex-wrap gap-2">
            <input
              className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
              placeholder="Group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
            <select
              className="rounded-md border border-black/[.08] bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm dark:border-white/[.145]"
              value={type}
              onChange={(e) => setType(e.target.value as ContributionGroupType)}
            >
              <option value="TARGET">Target savings</option>
              <option value="ROTATING">Rotating (Ajo)</option>
            </select>
            <select
              className="rounded-md border border-black/[.08] bg-white dark:bg-zinc-900 px-2 py-1.5 text-sm dark:border-white/[.145]"
              value={frequency}
              onChange={(e) => setFrequency(e.target.value as ContributionFrequency)}
            >
              <option value="DAILY">Daily</option>
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
              placeholder="Coordinator email"
              type="email"
              value={coordinatorEmail}
              onChange={(e) => setCoordinatorEmail(e.target.value)}
              required
            />
            <input
              className="w-32 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
              placeholder="Amount/period"
              value={contributionAmount}
              onChange={(e) => setContributionAmount(e.target.value)}
              required
            />
            {type === "TARGET" && (
              <input
                className="w-32 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
                placeholder="Target amount"
                value={targetAmount}
                onChange={(e) => setTargetAmount(e.target.value)}
              />
            )}
          </div>
          <button
            type="submit"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Create group
          </button>
        </form>
      </section>
    </>
  );
}
