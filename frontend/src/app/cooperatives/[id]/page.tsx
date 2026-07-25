"use client";

import { useEffect, useState, use, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  ApiError,
  downloadFile,
  getAccessToken,
  type AuditLogEntry,
  type AuthUser,
  type Branch,
  type Committee,
  type ComplianceFiling,
  type Cooperative,
  type CooperativeMembership,
  type SavingsAccount,
  type SavingsProduct,
  type SavingsReceipt,
  type SavingsTransaction,
} from "@/lib/api";
import LoansSection from "./LoansSection";
import PaymentsSection from "./PaymentsSection";
import AccountingSection from "./AccountingSection";
import MeetingsSection from "./MeetingsSection";
import CommunicationSection from "./CommunicationSection";
import ReportsSection from "./ReportsSection";
import Sidebar from "./Sidebar";
import AiAssistantSection from "./AiAssistantSection";
import ContributionsSection from "./ContributionsSection";
import LandBankingSection from "./LandBankingSection";
import SyndicationSection from "./SyndicationSection";

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

  const [activeSection, setActiveSection] = useState("dashboard");
  const [me, setMe] = useState<AuthUser | null>(null);
  const [cooperative, setCooperative] = useState<Cooperative | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [committees, setCommittees] = useState<Committee[]>([]);
  const [members, setMembers] = useState<CooperativeMembership[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[] | null>(null);
  const [inviteLink, setInviteLink] = useState("");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pendingError, setPendingError] = useState<string | null>(null);

  const [profileName, setProfileName] = useState("");
  const [profileState, setProfileState] = useState("");
  const [profileRegistrationNumber, setProfileRegistrationNumber] = useState("");
  const [profileEmail, setProfileEmail] = useState("");
  const [profilePhone, setProfilePhone] = useState("");
  const [profileAddress, setProfileAddress] = useState("");
  const [bylaws, setBylaws] = useState("");
  const [financialYearStartMonth, setFinancialYearStartMonth] = useState(1);
  const [settingsMessage, setSettingsMessage] = useState<string | null>(null);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoError, setLogoError] = useState<string | null>(null);

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

  const [savingsProducts, setSavingsProducts] = useState<SavingsProduct[]>([]);
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[] | null>(null);
  const [mySavingsAccounts, setMySavingsAccounts] = useState<SavingsAccount[]>([]);
  const [productName, setProductName] = useState("");
  const [productCode, setProductCode] = useState("");
  const [productRate, setProductRate] = useState("0");
  const [productMinBalance, setProductMinBalance] = useState("0");
  const [productError, setProductError] = useState<string | null>(null);
  const [openAccountProduct, setOpenAccountProduct] = useState<Record<string, string>>({});
  const [savingsError, setSavingsError] = useState<string | null>(null);
  const [transactionDrafts, setTransactionDrafts] = useState<
    Record<string, { type: "DEPOSIT" | "WITHDRAWAL"; amount: string; narration: string }>
  >({});
  const [statements, setStatements] = useState<Record<string, SavingsTransaction[]>>({});
  const [expandedAccounts, setExpandedAccounts] = useState<Record<string, boolean>>({});
  const [receipts, setReceipts] = useState<Record<string, SavingsReceipt>>({});

  async function reload() {
    const [coop, branchList, committeeList, memberList] = await Promise.all([
      api.getCooperative(id),
      api.listBranches(id),
      api.listCommittees(id),
      api.listMembers(id),
    ]);
    setCooperative(coop);
    setProfileName(coop.name);
    setProfileState(coop.state ?? "");
    setProfileRegistrationNumber(coop.registrationNumber ?? "");
    setProfileEmail(coop.email ?? "");
    setProfilePhone(coop.phone ?? "");
    setProfileAddress(coop.address ?? "");
    setBylaws(coop.bylaws ?? "");
    setFinancialYearStartMonth(coop.financialYearStartMonth);
    if (coop.logoMimeType) {
      downloadFile(`/cooperatives/${id}/logo`)
        .then((blob) => setLogoUrl(URL.createObjectURL(blob)))
        .catch(() => setLogoUrl(null));
    } else {
      setLogoUrl(null);
    }
    setBranches(branchList);
    setCommittees(committeeList);
    setMembers(memberList);
    setFilings(await api.listComplianceFilingsForCooperative(id));
    setSavingsProducts(await api.listSavingsProducts(id));

    // Audit logs are governance/auditor-only; a 403 here just means this
    // viewer isn't one, so the section stays hidden rather than erroring.
    try {
      setAuditLogs(await api.listAuditLogs(id));
    } catch {
      setAuditLogs(null);
    }

    // The cooperative-wide savings ledger is treasurer/governance/auditor-only.
    try {
      setSavingsAccounts(await api.listSavingsAccountsForCooperative(id));
    } catch {
      setSavingsAccounts(null);
    }
  }

  async function reloadMySavings(userId: string) {
    setMySavingsAccounts(await api.listSavingsAccountsForMember(id, userId));
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    async function load() {
      setInviteLink(`${window.location.origin}/cooperatives/${id}/join`);
      try {
        const currentUser = await api.me();
        setMe(currentUser);
        await reload();
        await reloadMySavings(currentUser.id);
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
      const updated = await api.updateCooperative(id, {
        name: profileName,
        state: profileState || undefined,
        registrationNumber: profileRegistrationNumber || undefined,
        email: profileEmail || undefined,
        phone: profilePhone || undefined,
        address: profileAddress || undefined,
        bylaws,
        financialYearStartMonth,
      });
      setCooperative(updated);
      setSettingsMessage("Saved");
    } catch (err) {
      setSettingsError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onUploadLogo(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLogoError(null);
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await api.updateCooperativeLogo(id, { mimeType: file.type, contentBase64 });
      const blob = await downloadFile(`/cooperatives/${id}/logo`);
      setLogoUrl(URL.createObjectURL(blob));
    } catch (err) {
      setLogoError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      e.target.value = "";
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

  async function onCreateSavingsProduct(e: FormEvent) {
    e.preventDefault();
    setProductError(null);
    try {
      await api.createSavingsProduct(id, {
        name: productName,
        code: productCode,
        interestRatePercent: Number(productRate),
        minimumBalance: Number(productMinBalance),
      });
      setProductName("");
      setProductCode("");
      setProductRate("0");
      setProductMinBalance("0");
      setSavingsProducts(await api.listSavingsProducts(id));
    } catch (err) {
      setProductError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onOpenSavingsAccount(userId: string) {
    const productId = openAccountProduct[userId];
    if (!productId) return;
    setSavingsError(null);
    try {
      await api.openSavingsAccount(id, userId, { productId });
      setOpenAccountProduct((prev) => ({ ...prev, [userId]: "" }));
      setSavingsAccounts(await api.listSavingsAccountsForCooperative(id));
      if (userId === me?.id) await reloadMySavings(userId);
    } catch (err) {
      setSavingsError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onRecordTransaction(accountId: string, memberUserId: string) {
    const draft = transactionDrafts[accountId];
    if (!draft || !draft.amount) return;
    setSavingsError(null);
    try {
      await api.recordSavingsTransaction(id, accountId, {
        type: draft.type,
        amount: Number(draft.amount),
        narration: draft.narration || undefined,
      });
      setTransactionDrafts((prev) => ({
        ...prev,
        [accountId]: { type: "DEPOSIT", amount: "", narration: "" },
      }));
      setSavingsAccounts(await api.listSavingsAccountsForCooperative(id));
      if (memberUserId === me?.id) await reloadMySavings(memberUserId);
      if (expandedAccounts[accountId]) await onToggleStatement(accountId, true);
    } catch (err) {
      setSavingsError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onAccrueInterest(accountId: string, memberUserId: string) {
    setSavingsError(null);
    try {
      await api.accrueSavingsInterest(id, accountId);
      setSavingsAccounts(await api.listSavingsAccountsForCooperative(id));
      if (memberUserId === me?.id) await reloadMySavings(memberUserId);
      if (expandedAccounts[accountId]) await onToggleStatement(accountId, true);
    } catch (err) {
      setSavingsError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onToggleStatement(accountId: string, forceOpen = false) {
    const willOpen = forceOpen || !expandedAccounts[accountId];
    if (willOpen) {
      const transactions = await api.listSavingsTransactions(id, accountId);
      setStatements((prev) => ({ ...prev, [accountId]: transactions }));
    }
    setExpandedAccounts((prev) => ({ ...prev, [accountId]: willOpen }));
  }

  async function onViewReceipt(accountId: string, transactionId: string) {
    try {
      const receipt = await api.getSavingsReceipt(id, accountId, transactionId);
      setReceipts((prev) => ({ ...prev, [transactionId]: receipt }));
    } catch (err) {
      setSavingsError(err instanceof ApiError ? err.message : "Something went wrong");
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

  function renderStatement(accountId: string) {
    const txs = statements[accountId];
    if (!txs) return null;
    return (
      <ul className="mt-2 space-y-1 border-t border-black/[.08] pt-2 text-xs dark:border-white/[.145]">
        {txs.map((t) => (
          <li key={t.id} className="space-y-1">
            <div className="flex items-center justify-between">
              <span>
                {new Date(t.createdAt).toLocaleDateString()} — {t.type} {t.amount}
                {t.narration && ` (${t.narration})`}
              </span>
              <span className="flex items-center gap-2">
                <span className="text-zinc-500">bal {t.balanceAfter}</span>
                <button
                  onClick={() => onViewReceipt(accountId, t.id)}
                  className="text-zinc-500 hover:underline"
                >
                  Receipt
                </button>
              </span>
            </div>
            {receipts[t.id] && (
              <div className="flex items-center gap-3 rounded-md bg-black/[.03] p-2 dark:bg-white/[.05]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={receipts[t.id].qrCodeDataUrl} alt="Receipt QR code" className="h-16 w-16" />
                <span className="text-zinc-600 dark:text-zinc-400">
                  {receipts[t.id].account.accountNumber} · {receipts[t.id].member.firstName}{" "}
                  {receipts[t.id].member.lastName}
                </span>
              </div>
            )}
          </li>
        ))}
        {txs.length === 0 && <li className="text-zinc-500">No transactions yet.</li>}
      </ul>
    );
  }

  function renderManagedSavingsAccount(account: SavingsAccount) {
    const draft = transactionDrafts[account.id] ?? {
      type: "DEPOSIT" as const,
      amount: "",
      narration: "",
    };
    const memberUserId = account.membership?.user.id ?? "";
    return (
      <li
        key={account.id}
        className="space-y-2 border-b border-black/[.08] pb-3 last:border-0 dark:border-white/[.145]"
      >
        <div className="flex items-center justify-between text-sm">
          <span>
            {account.membership?.user.firstName} {account.membership?.user.lastName} —{" "}
            {account.product?.name} <span className="text-zinc-500">({account.accountNumber})</span>
          </span>
          <span className="font-medium">₦{account.balance}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
            value={draft.type}
            onChange={(e) =>
              setTransactionDrafts((prev) => ({
                ...prev,
                [account.id]: { ...draft, type: e.target.value as "DEPOSIT" | "WITHDRAWAL" },
              }))
            }
          >
            <option value="DEPOSIT">Deposit</option>
            <option value="WITHDRAWAL">Withdrawal</option>
          </select>
          <input
            className="w-24 rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
            placeholder="Amount"
            value={draft.amount}
            onChange={(e) =>
              setTransactionDrafts((prev) => ({ ...prev, [account.id]: { ...draft, amount: e.target.value } }))
            }
          />
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
            placeholder="Narration"
            value={draft.narration}
            onChange={(e) =>
              setTransactionDrafts((prev) => ({ ...prev, [account.id]: { ...draft, narration: e.target.value } }))
            }
          />
          <button
            onClick={() => onRecordTransaction(account.id, memberUserId)}
            className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Record
          </button>
          <button
            onClick={() => onAccrueInterest(account.id, memberUserId)}
            className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Accrue interest
          </button>
          <button
            onClick={() => onToggleStatement(account.id)}
            className="text-xs text-zinc-500 hover:underline"
          >
            {expandedAccounts[account.id] ? "Hide statement" : "Statement"}
          </button>
        </div>
        {expandedAccounts[account.id] && renderStatement(account.id)}
      </li>
    );
  }

  function renderMySavingsAccount(account: SavingsAccount) {
    return (
      <li
        key={account.id}
        className="space-y-2 border-b border-black/[.08] pb-3 last:border-0 dark:border-white/[.145]"
      >
        <div className="flex items-center justify-between text-sm">
          <span>
            {account.product?.name} <span className="text-zinc-500">({account.accountNumber})</span>
          </span>
          <span className="font-medium">₦{account.balance}</span>
        </div>
        <button
          onClick={() => onToggleStatement(account.id)}
          className="text-xs text-zinc-500 hover:underline"
        >
          {expandedAccounts[account.id] ? "Hide statement" : "View statement"}
        </button>
        {expandedAccounts[account.id] && renderStatement(account.id)}
      </li>
    );
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
    <div className="w-full flex-1 bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-6 sm:flex-row">
        <Sidebar activeSection={activeSection} onSelect={setActiveSection} />
        <div className="w-full max-w-2xl flex-1 space-y-6">
      <div>
        <Link href="/cooperatives" className="text-sm font-medium text-black dark:text-zinc-50">
          ← All cooperatives
        </Link>
        <div className="mt-2 flex items-center gap-3">
          {logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated blob URL, not a static asset
            <img src={logoUrl} alt={`${cooperative.name} logo`} className="h-10 w-10 rounded-md object-cover" />
          )}
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">{cooperative.name}</h1>
        </div>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          /{cooperative.slug}
          {cooperative.state && ` · ${cooperative.state}`}
        </p>
        {inviteLink && (
          <p className="mt-2 text-xs text-zinc-500 dark:text-zinc-500">
            Invite link: <span className="break-all">{inviteLink}</span>
          </p>
        )}
      </div>

      <div className={activeSection === "dashboard" ? "" : "hidden"}>
        <ReportsSection cooperativeId={id} />
      </div>

      <div className={activeSection === "settings" ? "space-y-6" : "hidden"}>
      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Settings</h2>
        <form onSubmit={onSaveSettings} className="space-y-3">
          <ErrorText message={settingsError} />
          {settingsMessage && <p className="text-sm text-zinc-600 dark:text-zinc-400">{settingsMessage}</p>}

          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Logo
            <div className="mt-1 flex items-center gap-3">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- authenticated blob URL, not a static asset
                <img src={logoUrl} alt="Cooperative logo" className="h-12 w-12 rounded-md object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-md border border-dashed border-black/[.15] dark:border-white/[.2]" />
              )}
              <input type="file" accept="image/*" onChange={onUploadLogo} className="text-sm" />
            </div>
          </label>
          <ErrorText message={logoError} />

          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Name
            <input
              className="mt-1 w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              required
            />
          </label>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            State
            <input
              className="mt-1 w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
              value={profileState}
              onChange={(e) => setProfileState(e.target.value)}
            />
          </label>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Registration number
            <input
              className="mt-1 w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
              value={profileRegistrationNumber}
              onChange={(e) => setProfileRegistrationNumber(e.target.value)}
            />
          </label>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Email
            <input
              type="email"
              className="mt-1 w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
            />
          </label>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Phone
            <input
              className="mt-1 w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
              value={profilePhone}
              onChange={(e) => setProfilePhone(e.target.value)}
            />
          </label>
          <label className="block text-sm text-zinc-600 dark:text-zinc-400">
            Address
            <input
              className="mt-1 w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
              value={profileAddress}
              onChange={(e) => setProfileAddress(e.target.value)}
            />
          </label>
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
      </div>

      <div className={activeSection === "members" ? "space-y-6" : "hidden"}>
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
                  {savingsProducts.length > 0 && (
                    <>
                      <select
                        className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
                        value={openAccountProduct[m.userId] ?? ""}
                        onChange={(e) =>
                          setOpenAccountProduct((prev) => ({ ...prev, [m.userId]: e.target.value }))
                        }
                      >
                        <option value="">Savings product…</option>
                        {savingsProducts.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => onOpenSavingsAccount(m.userId)}
                        disabled={!openAccountProduct[m.userId]}
                        className="rounded-full border border-black/[.08] px-3 py-1 text-xs font-medium text-black transition-colors hover:bg-black/[.04] disabled:opacity-40 dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
                      >
                        + Savings account
                      </button>
                    </>
                  )}
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
      </div>

      <div className={activeSection === "savings" ? "space-y-6" : "hidden"}>
      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">My savings</h2>
        <ul className="space-y-2">{mySavingsAccounts.map(renderMySavingsAccount)}</ul>
        {mySavingsAccounts.length === 0 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-500">No savings accounts opened yet.</p>
        )}
      </section>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Savings products</h2>
        <ErrorText message={productError} />
        <ul className="space-y-1 text-sm">
          {savingsProducts.map((p) => (
            <li key={p.id} className="flex items-center justify-between">
              <span>
                {p.name} <span className="text-xs text-zinc-500">({p.code})</span>
              </span>
              <span className="text-xs text-zinc-500">
                {p.interestRatePercent}% · min ₦{p.minimumBalance}
                {!p.isActive && " · inactive"}
              </span>
            </li>
          ))}
          {savingsProducts.length === 0 && (
            <li className="text-zinc-500 dark:text-zinc-500">No savings products yet.</li>
          )}
        </ul>
        <form onSubmit={onCreateSavingsProduct} className="flex flex-wrap gap-2">
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Product name"
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            required
          />
          <input
            className="w-24 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Code"
            value={productCode}
            onChange={(e) => setProductCode(e.target.value)}
            required
          />
          <input
            className="w-24 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Interest %"
            value={productRate}
            onChange={(e) => setProductRate(e.target.value)}
          />
          <input
            className="w-28 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Min balance"
            value={productMinBalance}
            onChange={(e) => setProductMinBalance(e.target.value)}
          />
          <button
            type="submit"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Add
          </button>
        </form>
      </section>

      {savingsAccounts && (
        <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">Savings accounts</h2>
          <ErrorText message={savingsError} />
          <ul className="space-y-3">{savingsAccounts.map(renderManagedSavingsAccount)}</ul>
          {savingsAccounts.length === 0 && (
            <p className="text-sm text-zinc-500 dark:text-zinc-500">No savings accounts opened yet.</p>
          )}
        </section>
      )}
      </div>

      <div className={activeSection === "loans" ? "" : "hidden"}>
        <LoansSection cooperativeId={id} me={me} />
      </div>

      <div className={activeSection === "payments" ? "" : "hidden"}>
        <PaymentsSection cooperativeId={id} me={me} />
      </div>

      <div className={activeSection === "accounting" ? "" : "hidden"}>
        <AccountingSection cooperativeId={id} />
      </div>

      <div className={activeSection === "meetings" ? "" : "hidden"}>
        <MeetingsSection cooperativeId={id} me={me} />
      </div>

      <div className={activeSection === "documents" ? "" : "hidden"}>
        <CommunicationSection cooperativeId={id} />
      </div>

      <div className={activeSection === "ai" ? "" : "hidden"}>
        <AiAssistantSection cooperativeId={id} />
      </div>

      <section className={`space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950 ${activeSection === "compliance" ? "" : "hidden"}`}>
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
        <section className={`space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950 ${activeSection === "audit" ? "" : "hidden"}`}>
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

      <div className={activeSection === "contributions" ? "" : "hidden"}>
        <ContributionsSection cooperativeId={id} />
      </div>

      <div className={activeSection === "land-banking" ? "" : "hidden"}>
        <LandBankingSection cooperativeId={id} />
      </div>

      <div className={activeSection === "syndication" ? "" : "hidden"}>
        <SyndicationSection cooperativeId={id} active={activeSection === "syndication"} />
      </div>
        </div>
      </div>
    </div>
  );
}
