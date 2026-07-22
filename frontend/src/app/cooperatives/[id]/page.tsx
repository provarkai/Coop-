"use client";

import { useEffect, useState, use, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  ApiError,
  getAccessToken,
  type AuditLogEntry,
  type AuthUser,
  type Branch,
  type Committee,
  type ComplianceFiling,
  type Cooperative,
  type CooperativeMembership,
} from "@/lib/api";

const FILING_TYPES = ["ANNUAL_RETURN", "FINANCIAL_STATEMENT", "AGM_MINUTES", "OTHER"];

const COOPERATIVE_ROLES = [
  "MEMBER",
  "COMMITTEE_MEMBER",
  "LOAN_OFFICER",
  "AUDITOR",
  "TREASURER",
  "SECRETARY",
  "CHAIRMAN",
  "COOPERATIVE_ADMIN",
];

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

export default function CooperativeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const [me, setMe] = useState<AuthUser | null>(null);
  const [cooperative, setCooperative] = useState<Cooperative | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [members, setMembers] = useState<CooperativeMembership[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[] | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const [bylaws, setBylaws] = useState("");
  const [financialYearStartMonth, setFinancialYearStartMonth] = useState(1);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [branchName, setBranchName] = useState("");
  const [branchError, setBranchError] = useState<string | null>(null);

  const [committeeName, setCommitteeName] = useState("");
  const [committeeError, setCommitteeError] = useState<string | null>(null);
  const [committeeMemberEmail, setCommitteeMemberEmail] = useState<Record<string, string>>({});

  const [memberEmail, setMemberEmail] = useState("");
  const [memberRole, setMemberRole] = useState("MEMBER");
  const [memberError, setMemberError] = useState<string | null>(null);

  const [filings, setFilings] = useState<ComplianceFiling[]>([]);
  const [filingType, setFilingType] = useState("ANNUAL_RETURN");
  const [filingPeriod, setFilingPeriod] = useState("");
  const [filingTitle, setFilingTitle] = useState("");
  const [filingError, setFilingError] = useState<string | null>(null);

  async function reload() {
    const [coop, branchList, committeeList, memberList] = await Promise.all([
      api.getCooperative(id),
      api.listBranches(id),
      api.listCommittees(id),
      api.listMembers(id),
    ]);
    setCooperative(coop);
    setBylaws(coop.bylaws ?? "");
    setFinancialYearStartMonth(coop.financialYearStartMonth);
    setBranches(branchList);
    setCommittees(committeeList);
    setMembers(memberList);
    setFilings(await api.listComplianceFilingsForCooperative(id));

    // Audit logs are governance/auditor-only; a 403 here just means this
    // viewer isn't one, so the section stays hidden rather than erroring.
    try {
      setAuditLogs(await api.listAuditLogs(id));
    } catch {
      setAuditLogs(null);
    }
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    async function load() {
      setInviteLink(`${window.location.origin}/cooperatives/${id}/join`);
      try {
        setMe(await api.me());
        await reload();
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Something went wrong");
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, router]);

  async function onApproveMember(userId: string) {
    setPendingError(null);
    try {
      await api.approveMembership(id, userId);
      setMembers(await api.listMembers(id));
    } catch (err) {
      setPendingError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onRejectMember(userId: string) {
    setPendingError(null);
    try {
      await api.rejectMembership(id, userId);
      setMembers(await api.listMembers(id));
    } catch (err) {
      setPendingError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onSaveSettings(e: FormEvent) {
    e.preventDefault();
    setSettingsError(null);
    setSettingsMessage(null);
    try {
      const updated = await api.updateCooperative(id, { bylaws, financialYearStartMonth });
      setCooperative(updated);
      setSettingsMessage("Saved");
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onAddBranch(e: FormEvent) {
    e.preventDefault();
    setBranchError(null);
    try {
      await api.createBranch(id, { name: branchName });
      setBranchName("");
      setBranches(await api.listBranches(id));
    } catch (err) {
      setBranchError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onDeleteBranch(branchId: string) {
    try {
      await api.deleteBranch(id, branchId);
      setBranches(await api.listBranches(id));
    } catch (err) {
      setBranchError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onAddCommittee(e: FormEvent) {
    e.preventDefault();
    setCommitteeError(null);
    try {
      await api.createCommittee(id, { name: committeeName });
      setCommitteeName("");
      setCommittees(await api.listCommittees(id));
    } catch (err) {
      setCommitteeError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onAddCommitteeMember(committeeId: string) {
    setCommitteeError(null);
    const email = committeeMemberEmail[committeeId];
    if (!email) return;
    try {
      await api.addCommitteeMember(id, committeeId, { email });
      setCommitteeMemberEmail((prev) => ({ ...prev, [committeeId]: "" }));
      setCommittees(await api.listCommittees(id));
    } catch (err) {
      setCommitteeError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onRemoveCommitteeMember(committeeId: string, userId: string) {
    try {
      await api.removeCommitteeMember(id, committeeId, userId);
      setCommittees(await api.listCommittees(id));
    } catch (err) {
      setCommitteeError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onAddMember(e: FormEvent) {
    e.preventDefault();
    setMemberError(null);
    try {
      await api.addMember(id, { email: memberEmail, role: memberRole });
      setMemberEmail("");
      setMembers(await api.listMembers(id));
    } catch (err) {
      setMemberError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onUpdateMemberRole(userId: string, role: string) {
    if (userId === me?.id) {
      const confirmed = window.confirm(
        "You are changing your own role. If you remove your own governance access, you may lose the ability to manage this cooperative unless another admin or chairman remains. Continue?",
      );
      if (!confirmed) {
        setMembers((prev) => [...prev]);
        return;
      }
    }
    setMemberError(null);
    try {
      await api.updateMembership(id, userId, { role });
      setMembers(await api.listMembers(id));
    } catch (err) {
      setMemberError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onRemoveMember(userId: string) {
    try {
      await api.removeMembership(id, userId);
      setMembers(await api.listMembers(id));
    } catch (err) {
      setMemberError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onSubmitFiling(e: FormEvent) {
    e.preventDefault();
    setFilingError(null);
    try {
      await api.createComplianceFiling(id, { type: filingType, period: filingPeriod, title: filingTitle });
      setFilingPeriod("");
      setFilingTitle("");
      setFilings(await api.listComplianceFilingsForCooperative(id));
    } catch (err) {
      setFilingError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
          <ErrorText message={loadError} />
          <Link href="/cooperatives" className="text-sm font-medium text-black dark:text-zinc-50">
            Back to cooperatives
          </Link>
        </div>
      </div>
    );
  }

  if (!cooperative) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 bg-zinc-50 px-4 py-10 dark:bg-black">
      <div>
        <Link href="/cooperatives" className="text-sm font-medium text-black dark:text-zinc-50">
          ← All cooperatives
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">{cooperative.name}</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">/{cooperative.slug}</p>
        {inviteLink && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            Invite link: <span className="break-all">{inviteLink}</span>
          </p>
        )}
      </div>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Settings</h2>
        <form onSubmit={onSaveSettings} className="space-y-3">
          <ErrorText message={settingsError} />
          {settingsMessage && <p className="text-sm text-zinc-600 dark:text-zinc-400">{settingsMessage}</p>}
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            By-laws
            <textarea
              className="mt-1 w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
              rows={3}
              value={bylaws}
              onChange={(e) => setBylaws(e.target.value)}
            />
          </label>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Financial year start month
            <select
              className="mt-1 w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
              value={financialYearStartMonth}
              onChange={(e) => setFinancialYearStartMonth(Number(e.target.value))}
            >
              {Array.from({ length: 12 }, (_, i) => i + 1).map((month) => (
                <option key={month} value={month}>
                  {month}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Save
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Branches</h2>
        <ErrorText message={branchError} />
        <ul className="space-y-1">
          {branches.map((branch) => (
            <li key={branch.id} className="flex items-center justify-between text-sm">
              <span>
                {branch.name}
                {branch.isHeadOffice && <span className="ml-2 text-xs text-zinc-500">(head office)</span>}
              </span>
              <button
                onClick={() => onDeleteBranch(branch.id)}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={onAddBranch} className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="New branch name"
            value={branchName}
            onChange={(e) => setBranchName(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Add
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Committees</h2>
        <ErrorText message={committeeError} />
        <ul className="space-y-4">
          {committees.map((committee) => (
            <li key={committee.id} className="space-y-2">
              <p className="text-sm font-medium text-black dark:text-zinc-50">{committee.name}</p>
              <ul className="space-y-1 pl-3">
                {committee.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm text-zinc-600 dark:text-zinc-400">
                    <span>
                      {m.user.firstName} {m.user.lastName}
                      {m.title && ` — ${m.title}`}
                    </span>
                    <button
                      onClick={() => onRemoveCommitteeMember(committee.id, m.userId)}
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2 pl-3">
                <input
                  className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
                  placeholder="Member email"
                  value={committeeMemberEmail[committee.id] ?? ""}
                  onChange={(e) =>
                    setCommitteeMemberEmail((prev) => ({ ...prev, [committee.id]: e.target.value }))
                  }
                />
                <button
                  onClick={() => onAddCommitteeMember(committee.id)}
                  className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
                >
                  Add
                </button>
              </div>
            </li>
          ))}
        </ul>
        <form onSubmit={onAddCommittee} className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="New committee name"
            value={committeeName}
            onChange={(e) => setCommitteeName(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Add
          </button>
        </form>
      </section>

      {members.some((m) => m.status === "PENDING") && (
        <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">Pending applications</h2>
          <ErrorText message={pendingError} />
          <ul className="space-y-2">
            {members
              .filter((m) => m.status === "PENDING")
              .map((m) => (
                <li key={m.id} className="flex items-center justify-between text-sm">
                  <span>
                    {m.user.firstName} {m.user.lastName}{" "}
                    <span className="text-zinc-500 dark:text-zinc-500">({m.user.email})</span>
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onApproveMember(m.userId)}
                      className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => onRejectMember(m.userId)}
                      className="text-xs text-red-600 hover:underline dark:text-red-400"
                    >
                      Reject
                    </button>
                  </div>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Members</h2>
        <ErrorText message={memberError} />
        <ul className="space-y-2">
          {members
            .filter((m) => m.status === "ACTIVE")
            .map((m) => (
              <li key={m.id} className="flex items-center justify-between text-sm">
                <Link href={`/cooperatives/${id}/members/${m.userId}`} className="hover:underline">
                  {m.user.firstName} {m.user.lastName}{" "}
                  <span className="text-zinc-500 dark:text-zinc-500">({m.user.email})</span>
                </Link>
                <div className="flex items-center gap-2">
                  <select
                    className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
                    value={m.role}
                    onChange={(e) => onUpdateMemberRole(m.userId, e.target.value)}
                  >
                    {COOPERATIVE_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => onRemoveMember(m.userId)}
                    className="text-xs text-red-600 hover:underline dark:text-red-400"
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
        </ul>
        <form onSubmit={onAddMember} className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Member email"
            type="email"
            value={memberEmail}
            onChange={(e) => setMemberEmail(e.target.value)}
            required
          />
          <select
            className="rounded-md border border-black/[.08] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.145]"
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value)}
          >
            {COOPERATIVE_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
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
        <h2 className="font-semibold text-black dark:text-zinc-50">Compliance filings</h2>
        <ErrorText message={filingError} />
        <ul className="space-y-1 text-sm">
          {filings.map((f) => (
            <li key={f.id} className="flex items-center justify-between">
              <span>
                {f.title} <span className="text-xs text-zinc-500">({f.type} · {f.period})</span>
              </span>
              <span
                className={
                  f.status === "APPROVED"
                    ? "text-xs text-green-600 dark:text-green-400"
                    : f.status === "REJECTED"
                      ? "text-xs text-red-600 dark:text-red-400"
                      : "text-xs text-zinc-500"
                }
              >
                {f.status}
              </span>
            </li>
          ))}
          {filings.length === 0 && (
            <li className="text-zinc-500 dark:text-zinc-500">No filings submitted yet.</li>
          )}
        </ul>
        <form onSubmit={onSubmitFiling} className="space-y-2">
          <div className="flex gap-2">
            <select
              className="rounded-md border border-black/[.08] bg-transparent px-2 py-1.5 text-sm dark:border-white/[.145]"
              value={filingType}
              onChange={(e) => setFilingType(e.target.value)}
            >
              {FILING_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
            <input
              className="w-24 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
              placeholder="Period"
              value={filingPeriod}
              onChange={(e) => setFilingPeriod(e.target.value)}
              required
            />
            <input
              className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
              placeholder="Title"
              value={filingTitle}
              onChange={(e) => setFilingTitle(e.target.value)}
              required
            />
          </div>
          <button
            type="submit"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Submit filing
          </button>
        </form>
      </section>

      {auditLogs && (
        <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">Audit log</h2>
          <ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
            {auditLogs.map((entry) => (
              <li key={entry.id}>
                {new Date(entry.createdAt).toLocaleString()} — {entry.action}
              </li>
            ))}
            {auditLogs.length === 0 && <li>No activity recorded yet.</li>}
          </ul>
        </section>
      )}
    </div>
  );
}
