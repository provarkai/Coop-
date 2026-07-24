"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, getAccessToken, type AuthUser, type Cooperative } from "@/lib/api";

export default function CooperativesPage() {
  const router = useRouter();
  const [cooperatives, setCooperatives] = useState<Cooperative[] | null>(null);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    api
      .listCooperatives()
      .then(setCooperatives)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Something went wrong"));
    api.me().then(setMe).catch(() => {});
  }, [router]);

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-12 dark:bg-black">
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold text-black dark:text-zinc-50">My cooperatives</h1>
          {me?.role === "SUPER_ADMIN" && (
            <Link
              href="/cooperatives/new"
              className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              + New
            </Link>
          )}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {cooperatives && cooperatives.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            You&apos;re not a member of any cooperative yet.
          </p>
        )}

        {cooperatives && cooperatives.length > 0 && (
          <ul className="divide-y divide-black/[.08] dark:divide-white/[.145]">
            {cooperatives.map((coop) => (
              <li key={coop.id} className="py-3">
                <Link
                  href={`/cooperatives/${coop.id}`}
                  className="font-medium text-black hover:underline dark:text-zinc-50"
                >
                  {coop.name}
                </Link>
                <p className="text-sm text-zinc-500 dark:text-zinc-500">/{coop.slug}</p>
              </li>
            ))}
          </ul>
        )}

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/dashboard" className="font-medium text-black dark:text-zinc-50">
            Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
