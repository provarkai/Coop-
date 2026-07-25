"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { api, ApiError, type Payment } from "@/lib/api";

function statusMessage(status: Payment["status"]) {
  if (status === "SUCCESS") return "Payment successful.";
  if (status === "FAILED") return "Payment failed.";
  return "Still waiting for Paystack to confirm this payment…";
}

function PaymentCallback() {
  const searchParams = useSearchParams();
  const cooperativeId = searchParams.get("cooperativeId") ?? "";
  const reference = searchParams.get("reference") ?? searchParams.get("trxref") ?? "";

  const [payment, setPayment] = useState<Payment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function verify() {
      if (!cooperativeId || !reference) {
        setError("Missing payment reference — this link looks incomplete.");
        setLoading(false);
        return;
      }
      try {
        setPayment(await api.verifyPaymentByReference(cooperativeId, reference));
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    }
    void verify();
  }, [cooperativeId, reference]);

  return (
    <div className="w-full max-w-sm space-y-4 rounded-xl border border-black/[.08] bg-white p-8 text-center dark:border-white/[.145] dark:bg-zinc-950">
      <h1 className="text-xl font-semibold text-black dark:text-zinc-50">Payment</h1>
      {loading && <p className="text-sm text-zinc-600 dark:text-zinc-400">Checking with Paystack…</p>}
      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
      {!loading && !error && payment && (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {statusMessage(payment.status)} {payment.status === "INITIATED" && "Try “Check status” again in a moment."}
        </p>
      )}
      {cooperativeId && (
        <Link
          href={`/cooperatives/${cooperativeId}?section=payments`}
          className="inline-block rounded-full bg-foreground px-4 py-1.5 text-sm font-medium text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
        >
          Back to Payments
        </Link>
      )}
    </div>
  );
}

export default function PaymentCallbackPage() {
  return (
    <div className="flex flex-1 items-center justify-center bg-zinc-50 px-4 dark:bg-black">
      <Suspense fallback={null}>
        <PaymentCallback />
      </Suspense>
    </div>
  );
}
