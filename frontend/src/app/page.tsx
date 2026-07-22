import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 bg-zinc-50 px-4 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
        NCMS
      </h1>
      <p className="max-w-md text-zinc-600 dark:text-zinc-400">
        Nigerian Cooperative Management System
      </p>
      <div className="flex gap-4">
        <Link
          href="/login"
          className="rounded-full border border-black/[.08] px-5 py-2 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
        >
          Log in
        </Link>
        <Link
          href="/register"
          className="rounded-full bg-foreground px-5 py-2 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}
