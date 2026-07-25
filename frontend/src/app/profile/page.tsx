"use client";

import { useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api, ApiError, downloadFile, getAccessToken, type UserProfile } from "@/lib/api";

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    dateOfBirth: "",
    gender: "",
    phone: "",
    address: "",
    bvn: "",
    nin: "",
  });
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    async function load() {
      try {
        const data = await api.getProfile();
        setProfile(data);
        if (data.avatarMimeType) {
          downloadFile("/users/me/avatar")
            .then((blob) => setAvatarUrl(URL.createObjectURL(blob)))
            .catch(() => setAvatarUrl(null));
        }
        setForm({
          firstName: data.firstName,
          lastName: data.lastName,
          dateOfBirth: data.dateOfBirth ? data.dateOfBirth.slice(0, 10) : "",
          gender: data.gender ?? "",
          phone: data.phone ?? "",
          address: data.address ?? "",
          bvn: data.bvn ?? "",
          nin: data.nin ?? "",
        });
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Something went wrong");
      }
    }
    void load();
  }, [router]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);
    try {
      const payload = Object.fromEntries(
        Object.entries(form).filter(([, value]) => value !== ""),
      );
      const updated = await api.updateProfile(payload);
      setProfile(updated);
      setMessage("Profile saved");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
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
      const blob = await downloadFile("/users/me/avatar");
      setAvatarUrl(URL.createObjectURL(blob));
    } catch (err) {
      setAvatarError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      e.target.value = "";
    }
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 py-10 dark:bg-black">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm space-y-3 rounded-xl border border-black/[.08] bg-white p-8 dark:border-white/[.145] dark:bg-zinc-950"
      >
        <h1 className="text-xl font-semibold text-black dark:text-zinc-50">My profile (KYC)</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-500">{profile.email}</p>

        <div className="flex items-center gap-3">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- authenticated blob URL, not a static asset
            <img src={avatarUrl} alt="Profile photo" className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <div className="h-16 w-16 rounded-full border border-dashed border-black/[.15] dark:border-white/[.2]" />
          )}
          <label className="text-sm text-zinc-600 dark:text-zinc-400">
            Photo
            <input type="file" accept="image/*" onChange={onUploadAvatar} className="mt-1 block text-sm" />
          </label>
        </div>
        {avatarError && <p className="text-sm text-red-600 dark:text-red-400">{avatarError}</p>}

        {message && <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>}
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-2">
          <input
            className="w-1/2 rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
            placeholder="First name"
            value={form.firstName}
            onChange={(e) => setForm((f) => ({ ...f, firstName: e.target.value }))}
          />
          <input
            className="w-1/2 rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
            placeholder="Last name"
            value={form.lastName}
            onChange={(e) => setForm((f) => ({ ...f, lastName: e.target.value }))}
          />
        </div>

        <label className="block text-sm text-zinc-600 dark:text-zinc-400">
          Date of birth
          <input
            className="mt-1 w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => setForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
          />
        </label>

        <input
          className="w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
          placeholder="Gender"
          value={form.gender}
          onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
        />

        <input
          className="w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
          placeholder="Phone"
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
        />

        <input
          className="w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
          placeholder="Address"
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
        />

        <input
          className="w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
          placeholder="BVN"
          value={form.bvn}
          onChange={(e) => setForm((f) => ({ ...f, bvn: e.target.value }))}
        />

        <input
          className="w-full rounded-md border border-black/[.08] bg-transparent px-3 py-2 text-sm dark:border-white/[.145]"
          placeholder="NIN"
          value={form.nin}
          onChange={(e) => setForm((f) => ({ ...f, nin: e.target.value }))}
        />

        <button
          type="submit"
          className="w-full rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Save
        </button>

        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          <Link href="/dashboard" className="font-medium text-black dark:text-zinc-50">
            Back to dashboard
          </Link>
        </p>
      </form>
    </div>
  );
}
