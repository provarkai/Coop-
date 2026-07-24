"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, getAccessToken, type AuthUser } from "@/lib/api";

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function NewCooperativePage() {
  const router = useRouter();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [state, setState] = useState("");
  const [initialAdminEmail, setInitialAdminEmail] = useState("");
  const [regulatorEmail, setRegulatorEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    api
      .me()
      .then(setMe)
      .catch(() => router.replace("/login"));
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const coop = await api.createCooperative({
        name,
        slug,
        state,
        initialAdminEmail,
        ...(regulatorEmail ? { regulatorEmail } : {}),
      });
      router.push(`/cooperatives/${coop.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  if (!me) {
    return null;
  }

  if (me.role !== "SUPER_ADMIN") {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Cooperatives are onboarded by the platform team at a regulator&apos;s request. Reach out to
            your regulator if you need a new cooperative registered.
          </p>
          <Link href="/cooperatives" className="text-sm font-medium text-black dark:text-zinc-50">
            Back to cooperatives
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950"
      >
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Register a cooperative</h1>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">
            Per the Nigerian Co-operative Societies Act, cooperatives are registered by the platform
            team on a regulator&apos;s request, not self-service.
          </p>
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <input
          className="w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
          placeholder="Cooperative name"
          aria-label="Cooperative name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (!slugEdited) setSlug(slugify(e.target.value));
          }}
          required
        />

        <input
          className="w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
          placeholder="url-slug"
          aria-label="URL slug"
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSlugEdited(true);
          }}
          pattern="[a-z0-9]+(-[a-z0-9]+)*"
          required
        />

        <input
          className="w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
          placeholder="State (e.g. Lagos)"
          aria-label="State"
          value={state}
          onChange={(e) => setState(e.target.value)}
          required
        />

        <input
          className="w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
          placeholder="Initial admin's email (must already have an account)"
          aria-label="Initial admin email"
          type="email"
          value={initialAdminEmail}
          onChange={(e) => setInitialAdminEmail(e.target.value)}
          required
        />

        <input
          className="w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
          placeholder="Assign a regulator by email (optional)"
          aria-label="Regulator email"
          type="email"
          value={regulatorEmail}
          onChange={(e) => setRegulatorEmail(e.target.value)}
        />

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
        >
          {loading ? "Creating…" : "Create cooperative"}
        </button>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/cooperatives" className="font-medium text-black dark:text-zinc-50">
            Back to cooperatives
          </Link>
        </p>
      </form>
    </div>
  );
}
