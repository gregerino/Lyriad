"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export function LoginClient() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Fel lösenord");
      }
      router.replace("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Fel lösenord");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-16">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-8 shadow-lg"
      >
        <Image
          src="/lyriad-icon.png"
          alt=""
          width={160}
          height={160}
          priority
          className="mx-auto h-20 w-20"
        />
        <p className="mt-5 text-center font-mono text-xs uppercase tracking-[0.3em] text-ember-400">
          Lyriad
        </p>
        <h1 className="mt-2 text-center font-display text-2xl font-medium tracking-wide text-parchment-100">
          Logga in
        </h1>

        <div className="mt-6 flex flex-col gap-3">
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Lösenord"
            autoFocus
            className="focus-ring rounded-md border border-border-strong bg-background px-3 py-2 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
          />
          {error && <p className="text-xs text-danger-foreground">{error}</p>}
          <button
            type="submit"
            disabled={!password || submitting}
            className="focus-ring rounded-md bg-gradient-to-b from-ember-400 to-ember-500 px-4 py-2 text-sm font-medium text-ink-950 shadow-sm transition hover:shadow-glow-sm disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
          >
            {submitting ? "Loggar in…" : "Logga in"}
          </button>
        </div>
      </form>
    </div>
  );
}
