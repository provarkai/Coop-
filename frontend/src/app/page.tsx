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

const REGULATOR_FEATURES: { title: string; description: string }[] = [
  {
    title: "Real-time financial standing",
    description:
      "See active membership, savings, outstanding loans, cash position, and net surplus for every assigned cooperative as it stands today — not just at annual filing time.",
  },
  {
    title: "Compliance filing review",
    description:
      "Annual returns, financial statements, and AGM minutes are submitted straight into the system for you to review, approve, or reject with notes.",
  },
  {
    title: "Full audit trail",
    description:
      "Every governance action — approvals, disbursements, role changes, filings — is logged and attributable, giving you a complete record to inspect at any time.",
  },
  {
    title: "Automated fraud signals",
    description:
      "Unusually large transactions and rapid deposit/withdrawal round-trips are flagged automatically, surfacing risk before it becomes a complaint.",
  },
  {
    title: "Funds never commingled",
    description:
      "Member payments settle directly into each cooperative's own bank account via its own Paystack subaccount — the platform never holds member funds.",
  },
  {
    title: "State-scoped, federation-wide oversight",
    description:
      "You only see cooperatives assigned to you — mirroring the state Director of Cooperatives structure — with roll-up reporting across an entire union where cooperatives federate.",
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col bg-zinc-50 dark:bg-black">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-6">
        <span className="text-sm font-semibold tracking-tight text-black dark:text-zinc-50">
          Coop Manager
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
          Coop Manager
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

      <section className="border-y border-black/[.08] bg-white py-16 dark:border-white/[.145] dark:bg-zinc-950">
        <div className="mx-auto w-full max-w-5xl px-4">
          <div className="mb-8 text-center">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
              For regulators
            </h2>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-black dark:text-zinc-50">
              Oversight without waiting for paperwork
            </p>
            <p className="mx-auto mt-2 max-w-xl text-sm text-zinc-600 dark:text-zinc-400">
              Built for the state Director of Cooperatives structure — scoped visibility into
              every cooperative assigned to you, backed by real financial data instead of annual
              paper returns.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {REGULATOR_FEATURES.map((f) => (
              <div
                key={f.title}
                className="space-y-2 rounded-xl border border-black/[.08] bg-zinc-50 p-5 dark:border-white/[.145] dark:bg-black"
              >
                <h3 className="font-semibold text-black dark:text-zinc-50">{f.title}</h3>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">{f.description}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 flex justify-center">
            <Link
              href="/regulator"
              className="rounded-full bg-foreground px-6 py-2.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
            >
              Regulator dashboard
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto w-full max-w-5xl px-4 py-10 text-center text-xs text-zinc-500">
        Coop Manager — built for Nigerian cooperative societies.
      </footer>
    </div>
  );
}
