"use client";

import { useEffect, useState, use, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  api,
  ApiError,
  getAccessToken,
  type Beneficiary,
  type Guarantor,
  type MembershipCard,
} from "@/lib/api";

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

export default function MemberDetailPage({ params }: { params: Promise<{ id: string; userId: string }> }) {
  const { id, userId } = use(params);
  const router = useRouter();

  const [card, setCard] = useState<MembershipCard | null>(null);
  const [guarantors, setGuarantors] = useState<Guarantor[]>([]);
  const [beneficiaries, setBeneficiaries] = useState<Beneficiary[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [guarantorEmail, setGuarantorEmail] = useState("");
  const [guarantorError, setGuarantorError] = useState<string | null>(null);

  const [beneficiaryForm, setBeneficiaryForm] = useState({ fullName: "", relationship: "" });
  const [beneficiaryError, setBeneficiaryError] = useState<string | null>(null);

  async function reload() {
    const [cardData, guarantorList, beneficiaryList] = await Promise.all([
      api.getMembershipCard(id, userId),
      api.listGuarantors(id, userId),
      api.listBeneficiaries(id, userId),
    ]);
    setCard(cardData);
    setGuarantors(guarantorList);
    setBeneficiaries(beneficiaryList);
  }

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    async function load() {
      try {
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
      <div>
        <Link href={`/cooperatives/${id}`} className="text-sm font-medium text-black dark:text-zinc-50">
          ← {card.cooperative.name}
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">
          {card.member.firstName} {card.member.lastName}
        </h1>
      </div>

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
