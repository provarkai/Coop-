"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, getAccessToken } from "@/lib/api";

export default function MfaPage() {
  const router = useRouter();
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
    }
  }, [router]);

  async function onGenerate() {
    setError(null);
    setLoading(true);
    try {
      const result = await api.setupMfa();
      setQrCodeDataUrl(result.qrCodeDataUrl);
      setSecret(result.secret);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onEnable() {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await api.enableMfa(code);
      setMessage(result.message);
      setQrCodeDataUrl(null);
      setSecret(null);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function onDisable() {
    setError(null);
    setMessage(null);
    setLoading(true);
    try {
      const result = await api.disableMfa(code);
      setMessage(result.message);
      setCode("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Two-factor authentication
        </h1>

        {message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        {!qrCodeDataUrl && (
          <button
            onClick={onGenerate}
            disabled={loading}
            className="w-full rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Generate QR code to enable MFA
          </button>
        )}

        {qrCodeDataUrl && (
          <div className="flex flex-col items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- data: URI, not an optimizable remote image */}
            <img src={qrCodeDataUrl} alt="MFA QR code" className="h-40 w-40" />
            {secret && (
              <p className="break-all text-center text-xs text-zinc-500 dark:text-zinc-500">
                Manual entry key: {secret}
              </p>
            )}
          </div>
        )}

        <input
          className="w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
          placeholder="6-digit authenticator code"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          maxLength={6}
        />

        <div className="flex gap-2">
          <button
            onClick={onEnable}
            disabled={loading || code.length !== 6}
            className="w-full rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
          >
            Enable
          </button>
          <button
            onClick={onDisable}
            disabled={loading || code.length !== 6}
            className="w-full rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Disable
          </button>
        </div>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/dashboard" className="font-medium text-black dark:text-zinc-50">
            Back to dashboard
          </Link>
        </p>
      </div>
    </div>
  );
}
