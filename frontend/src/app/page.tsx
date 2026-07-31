import Link from "next/link";

const FEATURES: { title: string; description: string }[] = [
  {
    title: "Member management",
    description:
      "Onboard members with approval workflows, KYC profiles, photo IDs, membership cards, and guarantor/beneficiary tracking.",
  },
  {
    title: "Savings & loans",
    description:
      "Multiple savings products, interest accrual, loan products with guarantor requirements, repayment schedules, and automatic ledger posting.",
  },
  {
    title: "Real payments",
    description:
      "Members pay savings deposits and loan repayments straight into the cooperative's own bank account via Paystack — no funds ever sit with the platform.",
  },
  {
    title: "Contribution groups",
    description:
      "Run rotating and fixed-cycle group savings (Ajo/Esusu-style), with automatic payout scheduling and member confirmation.",
  },
  {
    title: "Land banking",
    description:
      "List land parcels, take group reservations gated on trust score and savings coverage, and record final allocations.",
  },
  {
    title: "Property syndication",
    description:
      "Pool members into property investments with escrow funding, milestone verification, and proportional payout allocation.",
  },
  {
    title: "Accounting & compliance",
    description:
      "Full double-entry ledger, trial balance and income statements, budget tracking, and regulator-facing compliance filings.",
  },
  {
    title: "Meetings & governance",
    description:
      "Schedule meetings, track attendance, record resolutions and votes, and generate AI-drafted minutes summaries.",
  },
  {
    title: "AI assistant & custom reports",
    description:
      "Members get instant answers about their own accounts; governance can describe any report topic in plain language and get back an AI-authored PDF built from the cooperative's real data.",
  },
  {
    title: "Bulk member import & export",
    description:
      "Onboard an entire membership list from a CSV in one upload, or export members, savings, loans, and journal entries at any time.",
  },
  {
    title: "Union oversight",
    description:
      "Cooperatives can join a union (federation/apex body) for roll-up reporting across every member cooperative's membership, savings, and loans.",
  },
  {
    title: "Regulator & audit trail",
    description:
      "State regulators get scoped visibility into assigned cooperatives' financial standing and filings, backed by a full audit log of every action.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6">
        <span className="text-sm font-semibold tracking-tight text-black dark:text-zinc-50">
          Lagos Coop Management
        </span>
        <nav className="flex items-center gap-3">
          <Link
            href="/login"
            className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Log in
          </Link>
          <Link
            href="/register"
            className="rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Create account
          </Link>
        </nav>
      </header>

      <section className="mx-auto flex w-full max-w-3xl flex-col items-center gap-6 px-4 py-16 text-center sm:py-24">
        <h1 className="text-4xl font-semibold tracking-tight text-black sm:text-5xl dark:text-zinc-50">
          Lagos Coop Management
        </h1>
        <p className="max-w-xl text-lg text-zinc-600 dark:text-zinc-400">
          One platform to run a Nigerian cooperative society end to end — members, savings,
          loans, real payments, governance, and regulatory compliance.
        </p>
        <div className="flex flex-wrap justify-center gap-4">
          <Link
            href="/register"
            className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-black/[.08] px-6 py-2.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
          >
            Log in
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-5xl px-4 pb-20">
        <h2 className="mb-8 text-center text-sm font-semibold uppercase tracking-wide text-zinc-500">
          Everything a cooperative society needs
        </h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="space-y-2 rounded-xl border border-black/[.08] bg-white p-5 dark:border-white/[.145] dark:bg-zinc-950"
            >
              <h3 className="font-semibold text-black dark:text-zinc-50">{f.title}</h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">{f.description}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto w-full max-w-5xl px-4 pb-10 text-center text-xs text-zinc-500">
        Lagos Coop Management — built for Nigerian cooperative societies.
      </footer>
    </div>
  );
}
