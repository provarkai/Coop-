"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, getAccessToken, type PlatformUser } from "@/lib/api";

const PLATFORM_ROLES = ["MEMBER", "REGULATOR", "SUPER_ADMIN"];

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<PlatformUser[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function reload() {
    setUsers(await api.listUsers());
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
        setError(
          err instanceof ApiError && err.status === 403
            ? "You don't have admin access on this platform."
            : err instanceof ApiError
              ? err.message
              : "Something went wrong",
        );
      }
    }
    void load();
  }, [router]);

  async function onChangeRole(userId: string, role: string) {
    setActionError(null);
    try {
      await api.updateUserRole(userId, role);
      await reload();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Something went wrong");
    }
  }

  if (error) {
    return (
      <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
        <div className="w-full max-w-sm space-y-4 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950">
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          <Link href="/dashboard" className="text-sm font-medium text-black dark:text-zinc-50">
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!users) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-2xl flex-1 space-y-6 bg-zinc-50 px-4 py-10 dark:bg-black">
      <div>
        <Link href="/dashboard" className="text-sm font-medium text-black dark:text-zinc-50">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-black dark:text-zinc-50">Platform users</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">
          Promote a user to REGULATOR or SUPER_ADMIN. They must log in again for the change to take effect.
        </p>
      </div>

      <section className="space-y-2 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
        {actionError && <p className="text-sm text-red-600 dark:text-red-400">{actionError}</p>}
        <ul className="space-y-2">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between text-sm">
              <span>
                {u.firstName} {u.lastName} <span className="text-zinc-500 dark:text-zinc-500">({u.email})</span>
              </span>
              <select
                className="rounded-md border border-black/[.08] bg-transparent px-2 py-1 text-xs dark:border-white/[.145]"
                value={u.role}
                onChange={(e) => onChangeRole(u.id, e.target.value)}
              >
                {[u.role, ...PLATFORM_ROLES.filter((r) => r !== u.role)].map((role) => (
                  <option key={role} value={role}>
                    {role}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
