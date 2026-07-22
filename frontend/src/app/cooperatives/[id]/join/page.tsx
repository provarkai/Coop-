"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, getAccessToken, type CooperativePreview } from "@/lib/api";

export default function JoinCooperativePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [preview, setPreview] = useState<CooperativePreview | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    api
      .getCooperativePreview(id)
      .then(setPreview)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Something went wrong"));
  }, [id, router]);

  async function onApply() {
    setLoading(true);
    setError(null);
    try {
      await api.applyToCooperative(id);
      setMessage("Your application has been submitted. An admin will review it.");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {preview && (
          <>
            <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Join {preview.name}</h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-500">/{preview.slug}</p>

            {message ? (
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
            ) : (
              <button
                onClick={onApply}
                disabled={loading}
                className="w-full rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
              >
                {loading ? "Applying…" : "Apply to join"}
              </button>
            )}
          </>
        )}

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/cooperatives" className="font-medium text-black dark:text-zinc-50">
            Back to cooperatives
          </Link>
        </p>
      </div>
    </div>
  );
}
