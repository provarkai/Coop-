"use client";

import { useState } from "react";

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
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop: unchanged sticky sidebar, sm breakpoint and up. */}
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

      {/* Mobile: below sm, the sidebar above is hidden entirely, so this menu button
          is the only way to jump between sections without manually scrolling. */}
      <div className="sticky top-0 z-20 mb-2 w-full border-b border-black/[.08] bg-zinc-50 px-3 py-2 sm:hidden dark:border-white/[.145] dark:bg-black">
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-label="Section menu"
          className="flex w-full items-center justify-between rounded-md border border-black/[.08] px-3 py-2 text-sm font-medium dark:border-white/[.145]"
        >
          Jump to section
          <span aria-hidden>{mobileOpen ? "▲" : "▼"}</span>
        </button>
        {mobileOpen && (
          <div className="mt-2 grid grid-cols-2 gap-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-md px-2 py-1.5 text-sm text-zinc-600 transition-colors hover:bg-black/[.04] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[.06] dark:hover:text-zinc-50"
              >
                {item.label}
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
