"use client";

import { useState } from "react";

export const NAV_ITEMS: { id: string; label: string }[] = [
  { id: "dashboard", label: "Dashboard" },
  { id: "settings", label: "Settings" },
  { id: "members", label: "Members" },
  { id: "savings", label: "Savings" },
  { id: "loans", label: "Loans" },
  { id: "payments", label: "Payments" },
  { id: "accounting", label: "Accounting" },
  { id: "meetings", label: "Meetings" },
  { id: "documents", label: "Documents & Comms" },
  { id: "ai", label: "AI Assistant" },
  { id: "compliance", label: "Compliance" },
  { id: "audit", label: "Audit log" },
  { id: "contributions", label: "Contribution Groups" },
  { id: "land-banking", label: "Land Banking" },
  { id: "syndication", label: "Syndication" },
];

export default function Sidebar({
  activeSection,
  onSelect,
}: {
  activeSection: string;
  onSelect: (id: string) => void;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  function itemClass(id: string) {
    return id === activeSection
      ? "rounded-md bg-black/[.06] px-2 py-1.5 text-left text-sm font-medium text-black dark:bg-white/[.1] dark:text-zinc-50"
      : "rounded-md px-2 py-1.5 text-left text-sm text-zinc-600 transition-colors hover:bg-black/[.04] hover:text-black dark:text-zinc-400 dark:hover:bg-white/[.06] dark:hover:text-zinc-50";
  }

  return (
    <>
      {/* Desktop: unchanged sticky sidebar, sm breakpoint and up. Only the
          selected section renders in the main column; the dashboard/report
          is the default landing view and every other section is a click away. */}
      <nav className="sticky top-10 hidden w-40 shrink-0 flex-col gap-1 self-start sm:flex">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            className={itemClass(item.id)}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {/* Mobile: below sm, the sidebar above is hidden entirely, so this menu button
          is the only way to switch between sections. */}
      <div className="sticky top-0 z-20 mb-2 w-full border-b border-black/[.08] bg-zinc-50 px-3 py-2 sm:hidden dark:border-white/[.145] dark:bg-black">
        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-expanded={mobileOpen}
          aria-label="Section menu"
          className="flex w-full items-center justify-between rounded-md border border-black/[.08] px-3 py-2 text-sm font-medium dark:border-white/[.145]"
        >
          {NAV_ITEMS.find((item) => item.id === activeSection)?.label ?? "Jump to section"}
          <span aria-hidden>{mobileOpen ? "▲" : "▼"}</span>
        </button>
        {mobileOpen && (
          <div className="mt-2 grid grid-cols-2 gap-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelect(item.id);
                  setMobileOpen(false);
                }}
                className={itemClass(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
