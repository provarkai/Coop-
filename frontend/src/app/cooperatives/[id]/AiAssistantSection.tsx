"use client";

import { useState, type FormEvent } from "react";
import { api, ApiError } from "@/lib/api";

function ErrorText({ message }: { message: string | null }) {
  if (!message) return null;
  return <p className="text-sm text-red-600 dark:text-red-400">{message}</p>;
}

export default function AiAssistantSection({ cooperativeId }: { cooperativeId: string }) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);

  async function onAsk(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setAsking(true);
    try {
      const res = await api.askAssistant(cooperativeId, question);
      setAnswer(res.answer);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Something went wrong");
    } finally {
      setAsking(false);
    }
  }

  return (
    <section className="space-y-3 rounded-xl border border-black/[.08] bg-white p-6 dark:border-white/[.145] dark:bg-zinc-950">
      <h2 className="font-semibold text-black dark:text-zinc-50">AI assistant</h2>
      <p className="text-xs text-zinc-500">
        Ask about your own savings, loans, or upcoming meetings in this cooperative.
      </p>
      <ErrorText message={error} />
      {answer && (
        <p className="whitespace-pre-wrap rounded-md border border-black/[.06] p-3 text-sm text-zinc-700 dark:border-white/[.1] dark:text-zinc-300">
          {answer}
        </p>
      )}
      <form onSubmit={onAsk} className="flex flex-wrap gap-2">
        <input
          className="flex-1 rounded-md border border-black/[.08] bg-transparent px-3 py-1.5 text-sm dark:border-white/[.145]"
          placeholder="e.g. What's my savings balance?"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          required
        />
        <button
          type="submit"
          disabled={asking}
          className="rounded-full border border-black/[.08] px-4 py-1.5 text-sm font-medium text-black transition-colors hover:bg-black/[.04] disabled:opacity-50 dark:border-white/[.145] dark:text-zinc-50 dark:hover:bg-[#1a1a1a]"
        >
          {asking ? "Asking…" : "Ask"}
        </button>
      </form>
    </section>
  );
}
