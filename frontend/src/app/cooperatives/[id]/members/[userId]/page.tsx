"use client";

import { useEffect, useState, use, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  ApiError,
  downloadFile,
  getAccessToken,
  saveBlob,
  type AuthUser,
  type Beneficiary,
  type Guarantor,
  type Loan,
  type MemberProfile,
  type MembershipCard,
  type SavingsAccount,
  type TrustScore,
} from "@/lib/api";

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

export default function MemberDetailPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = use(params);
  const router = useRouter();

  const [me, setMe] = useState<AuthUser | null>(null);
  const [card, setCard] = useState<MembershipCard | null>(null);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [savingsAccounts, setSavingsAccounts] = useState<SavingsAccount[]>([]);
  const [activeLoans, setActiveLoans] = useState<Loan[]>([]);
  const [trustScore, setTrustScore] = useState<TrustScore | null>(null);
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [guarantorEmail, setGuarantorEmail] = useState("");
  const [guarantorError, setGuarantorError] = useState<string | null>(null);

  const [beneficiaryForm, setBeneficiaryForm] = useState({ fullName: "", relationship: "" });
  const [beneficiaryError, setBeneficiaryError] = useState<string | null>(null);

  async function reload() {
    const [profileData, cardData, guarantorList, beneficiaryList] = await Promise.all([
      api.getMemberProfile(id, userId),
      api.getMembershipCard(id, userId),
      api.listGuarantors(id, userId),
      api.listBeneficiaries(id, userId),
    ]);
    setProfile(profileData);
    setCard(cardData);
    setGuarantors(guarantorList);
    setBeneficiaries(beneficiaryList);

    if (profileData.user.avatarMimeType) {
      downloadFile(`/cooperatives/${id}/members/${userId}/avatar`)
        .then((blob) => setAvatarUrl(URL.createObjectURL(blob)))
        .catch(() => setAvatarUrl(null));
    } else {
      setAvatarUrl(null);
    }

    // Savings/loans/trust-score have narrower role gates than the profile
    // itself (e.g. treasurer/loan-officer-only), and trust score only
    // applies to members in a contribution group -- a 403/404 here
    // just means that summary stays empty rather than breaking the page.
    try {
      setSavingsAccounts(await api.listSavingsAccountsForMember(id, userId));
    } catch {
      setSavingsAccounts([]);
    }
    try {
      setActiveLoans((await api.listLoansForMember(id, userId)).filter((l) => l.status === "ACTIVE"));
    } catch {
      setActiveLoans([]);
    }
    try {
      setTrustScore(await api.getMemberTrustScore(id, userId));
    } catch {
      setTrustScore(null);
    }
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    async function load() {
      try {
        setMe(await api.me());
        await reload();
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Something went wrong");
      }
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, userId, router]);

  async function onAddGuarantor(e: FormEvent) {
    e.preventDefault();
    setGuarantorError(null);
    try {
      await api.addGuarantor(id, userId, { email: guarantorEmail });
      setGuarantorEmail("");
      setGuarantors(await api.listGuarantors(id, userId));
    } catch (err) {
      setGuarantorError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onRemoveGuarantor(guarantorId: string) {
    try {
      await api.removeGuarantor(id, userId, guarantorId);
      setGuarantors(await api.listGuarantors(id, userId));
    } catch (err) {
      setGuarantorError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onAddBeneficiary(e: FormEvent) {
    e.preventDefault();
    setBeneficiaryError(null);
    try {
      await api.addBeneficiary(id, userId, beneficiaryForm);
      setBeneficiaryForm({ fullName: "", relationship: "" });
      setBeneficiaries(await api.listBeneficiaries(id, userId));
    } catch (err) {
      setBeneficiaryError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onDownloadCardPdf() {
    try {
      const blob = await downloadFile(`/cooperatives/${id}/members/${userId}/card.pdf`);
      saveBlob(blob, "membership-card.pdf");
    } catch (err) {
      setLoadError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  async function onUploadAvatar(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarError(null);
    try {
      const contentBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve((reader.result as string).split(",")[1]);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      await api.updateMyAvatar({ mimeType: file.type, contentBase64 });
      const blob = await downloadFile(`/cooperatives/${id}/members/${userId}/avatar`);
      setAvatarUrl(URL.createObjectURL(blob));
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      e.target.value = "";
    }
  }

  async function onRemoveBeneficiary(beneficiaryId: string) {
    try {
      await api.removeBeneficiary(id, userId, beneficiaryId);
      setBeneficiaries(await api.listBeneficiaries(id, userId));
    } catch (err) {
      setBeneficiaryError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (loadError) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
          <ErrorText message={loadError} />
          <Link href={`/cooperatives/${id}`} className="text-sm font-medium text-black dark:text-zinc-50">
            Back to cooperative
          </Link>
        </div>
      </div>
    );
  }

  if (!card) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 bg-zinc-50 px-4 py-10 dark:bg-black">
      <div className="flex items-center gap-4">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- authenticated blob URL, not a static asset
          <img src={avatarUrl} alt="Profile photo" className="h-16 w-16 rounded-full object-cover" />
        ) : (
          <div className="h-16 w-16 rounded-full border border-dashed border-black/[.15] dark:border-white/[.2]" />
        )}
        <div>
          <Link href={`/cooperatives/${id}`} className="text-sm font-medium text-black dark:text-zinc-50">
            ← {card.cooperative.name}
          </Link>
          <h1 className="mt-1 text-2xl font-semibold text-black dark:text-zinc-50">
            {card.member.firstName} {card.member.lastName}
          </h1>
        </div>
      </div>

      {profile && (
        <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">Profile</h2>
          {me?.id === userId && (
            <label className="block text-sm text-zinc-600 dark:text-zinc-400">
              Profile photo
              <input type="file" accept="image/*" onChange={onUploadAvatar} className="mt-1 block text-sm" />
            </label>
          )}
          <ErrorText message={avatarError} />
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            <dt className="text-zinc-500">Email</dt>
            <dd className="text-black dark:text-zinc-50">{profile.user.email}</dd>
            <dt className="text-zinc-500">Role</dt>
            <dd className="text-black dark:text-zinc-50">
              {profile.role} · {profile.category} · {profile.status}
            </dd>
            <dt className="text-zinc-500">Membership number</dt>
            <dd className="text-black dark:text-zinc-50">{profile.membershipNumber ?? "Not assigned yet"}</dd>
            <dt className="text-zinc-500">Joined</dt>
            <dd className="text-black dark:text-zinc-50">{new Date(profile.joinedAt).toLocaleDateString()}</dd>
            <dt className="text-zinc-500">Date of birth</dt>
            <dd className="text-black dark:text-zinc-50">
              {profile.user.dateOfBirth ? new Date(profile.user.dateOfBirth).toLocaleDateString() : "Not provided"}
            </dd>
            <dt className="text-zinc-500">Gender</dt>
            <dd className="text-black dark:text-zinc-50">{profile.user.gender ?? "Not provided"}</dd>
            <dt className="text-zinc-500">Phone</dt>
            <dd className="text-black dark:text-zinc-50">{profile.user.phone ?? "Not provided"}</dd>
            <dt className="text-zinc-500">Address</dt>
            <dd className="text-black dark:text-zinc-50">{profile.user.address ?? "Not provided"}</dd>
            <dt className="text-zinc-500">BVN</dt>
            <dd className="text-black dark:text-zinc-50">{profile.user.bvn ?? "Not provided"}</dd>
            <dt className="text-zinc-500">NIN</dt>
            <dd className="text-black dark:text-zinc-50">{profile.user.nin ?? "Not provided"}</dd>
          </dl>
        </section>
      )}

      {(savingsAccounts.length > 0 || activeLoans.length > 0 || trustScore) && (
        <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
          <h2 className="font-semibold text-black dark:text-zinc-50">Financial summary</h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {savingsAccounts.length > 0 && (
              <>
                <dt className="text-zinc-500">Savings accounts</dt>
                <dd className="text-black dark:text-zinc-50">
                  {savingsAccounts.map((a) => `${a.product?.name ?? a.accountNumber} (₦${a.balance})`).join(", ")}
                </dd>
              </>
            )}
            {activeLoans.length > 0 && (
              <>
                <dt className="text-zinc-500">Active loans</dt>
                <dd className="text-black dark:text-zinc-50">
                  {activeLoans.map((l) => `${l.product?.name ?? "Loan"} (bal ₦${l.outstandingBalance})`).join(", ")}
                </dd>
              </>
            )}
            {trustScore && (
              <>
                <dt className="text-zinc-500">Contribution trust score</dt>
                <dd className="text-black dark:text-zinc-50">
                  {trustScore.score} ({trustScore.rating})
                </dd>
              </>
            )}
          </dl>
          <Link
            href={`/cooperatives/${id}`}
            className="inline-block text-xs font-medium text-black underline dark:text-zinc-50"
          >
            View full ledger on the cooperative page
          </Link>
        </section>
      )}

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 text-center dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Membership card</h2>
        {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote image */}
        <img src={card.qrCodeDataUrl} alt="Membership QR code" className="mx-auto h-40 w-40" />
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {card.membershipNumber ?? "No membership number assigned yet"}
        </p>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          {card.role} · {card.category}
        </p>
        <button
          type="button"
          onClick={() => void onDownloadCardPdf()}
          className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
        >
          Download PDF
        </button>
      </section>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Guarantors</h2>
        <ErrorText message={guarantorError} />
        <ul className="space-y-1">
          {guarantors.map((g) => (
            <li key={g.id} className="flex items-center justify-between text-sm">
              <span>
                {g.guarantorUser ? `${g.guarantorUser.firstName} ${g.guarantorUser.lastName}` : g.guarantorUserId}{" "}
                <span className="text-xs text-zinc-500">({g.status})</span>
              </span>
              <button
                onClick={() => onRemoveGuarantor(g.id)}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={onAddGuarantor} className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Guarantor email"
            type="email"
            value={guarantorEmail}
            onChange={(e) => setGuarantorEmail(e.target.value)}
            required
          />
          <button
            type="submit"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Nominate
          </button>
        </form>
      </section>

      <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        <h2 className="font-semibold text-black dark:text-zinc-50">Beneficiaries</h2>
        <ErrorText message={beneficiaryError} />
        <ul className="space-y-1">
          {beneficiaries.map((b) => (
            <li key={b.id} className="flex items-center justify-between text-sm">
              <span>
                {b.fullName} <span className="text-xs text-zinc-500">({b.relationship})</span>
              </span>
              <button
                onClick={() => onRemoveBeneficiary(b.id)}
                className="text-xs text-red-600 hover:underline dark:text-red-400"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={onAddBeneficiary} className="flex gap-2">
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Full name"
            value={beneficiaryForm.fullName}
            onChange={(e) => setBeneficiaryForm((f) => ({ ...f, fullName: e.target.value }))}
            required
          />
          <input
            className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
            placeholder="Relationship"
            value={beneficiaryForm.relationship}
            onChange={(e) => setBeneficiaryForm((f) => ({ ...f, relationship: e.target.value }))}
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
  );
}
