"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, clearTokens, getAccessToken, getRefreshToken, type AuthUser } from "@/lib/api";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    api
      .me()
      .then(setUser)
      .catch(() => {
        clearTokens();
        router.replace("/login");
      });
  }, [router]);

  async function onLogout() {
    const refreshToken = getRefreshToken();
    try {
      if (refreshToken) await api.logout(refreshToken);
    } finally {
      clearTokens();
      router.replace("/login");
    }
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">
          Welcome, {user.email}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">Role: {user.role}</p>

        <div className="flex flex-col gap-2">
          <Link
            href="/mfa"
            className="w-full rounded-full border border-black/[.08] px-5 py-2 text-center text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Manage two-factor authentication
          </Link>
          <button
            onClick={onLogout}
            className="w-full rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Log out
          </button>
        </div>
      </div>
    </div>
  );
}
