"use client";

const NAV_ITEMS: { href: string; label: string }[] = [
  { href: "#dashboard", label: "Dashboard" },
  { href: "#settings", label: "Settings" },
  { href: "#members", label: "Members" },
  { href: "#savings", label: "Savings" },
  { href: "#loans", label: "Loans" },
  { href: "#payments", label: "Payments" },
  { href: "#accounting", label: "Accounting" },
  { href: "#meetings", label: "Meetings" },
  { href: "#documents", label: "Documents & Comms" },
  { href: "#ai", label: "AI Assistant" },
  { href: "#compliance", label: "Compliance" },
  { href: "#audit", label: "Audit log" },
];

export default function Sidebar() {
  return (
    <nav className="sticky top-10 hidden w-40 shrink-0 flex-col gap-1 self-start sm:flex">
      {NAV_ITEMS.map((item) => (
        <a
          key={item.href}
          href={item.href}
          className="rounded-md px-2 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-black/[.04] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[.06] dark:hover:text-zinc-50"
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}
