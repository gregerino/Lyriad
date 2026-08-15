"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { FavoriteScenesBar } from "@/components/scenes/FavoriteScenesBar";
import { LibraryIcon, ScenesIcon } from "@/components/ui/icons";

const MUSIC_SLOT_COUNT = 10;
const ONESHOT_SLOT_COUNT = 20;

/**
 * What "/" shows when there is no scene to fall back to. Deliberately not a
 * greyed-out mixer: thirty disabled placeholders read as an app that failed to
 * load rather than one waiting to be told what to build, and the dummy grid
 * never matched the real desk's layout anyway. So it explains the two kinds of
 * slot instead, which is the one thing a first-time scene doesn't say for
 * itself, and gets out of the way.
 */
export function MixerHome() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploaderOpen, setUploaderOpen] = useState(false);

  async function createScene() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, description: description.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Kunde inte skapa scenen");
      }
      const { scene } = await res.json();
      router.push(`/scenes/${scene.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa scenen");
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember-400">Lyriad</p>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-wide text-parchment-100 sm:text-3xl">
          Mixer
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Ingen scen laddad. En scen är ett mixerbord för ett ställe eller ett
          ögonblick i spelet — ge den ett namn så öppnas det direkt.
        </p>
      </div>

      <FavoriteScenesBar />

      <div className="rounded-lg border border-ember-400/40 bg-surface p-4 shadow-sm">
        <p className="text-sm font-medium text-parchment-100">Skapa en ny scen</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
          <input
            type="text"
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createScene();
            }}
            placeholder="Namn, t.ex. Krogen i Silverbäcken"
            className="focus-ring flex-1 rounded-md border border-border-strong bg-background px-3 py-1.5 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createScene();
            }}
            placeholder="Beskrivning (valfritt)"
            className="focus-ring flex-1 rounded-md border border-border-strong bg-background px-3 py-1.5 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
          />
          <button
            type="button"
            onClick={() => void createScene()}
            disabled={!name.trim() || submitting}
            className="focus-ring rounded-md bg-gradient-to-b from-ember-400 to-ember-500 px-4 py-1.5 text-sm font-medium text-ink-950 shadow-sm transition hover:shadow-glow-sm disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
          >
            {submitting ? "Skapar…" : "Skapa scen"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-danger-foreground">{error}</p>}
      </div>

      {/* The one thing a brand-new, empty scene can't explain about itself. */}
      <section className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface/60 p-4">
          <h2 className="font-display text-base font-medium tracking-wide text-parchment-100">
            {MUSIC_SLOT_COUNT} musikplatser
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Långa spår som ligger och går — stämning, väder, en kroglåt. Flera kan
            spela samtidigt, med varsin volym, loop och in- och uttoning.
          </p>
        </div>
        <div className="rounded-lg border border-border bg-surface/60 p-4">
          <h2 className="font-display text-base font-medium tracking-wide text-parchment-100">
            {ONESHOT_SLOT_COUNT} one-shots
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Korta ljud du avfyrar i stunden — en dörr, ett åskslag, ett tärningskast.
            De lägger sig ovanpå varandra och avbryter aldrig musiken. En pad kan
            loopa, och padgriden visar ett set i taget — set hör inte till någon
            scen, så samma bank kan användas i vilken scen som helst.
          </p>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-xs">
        <button
          type="button"
          onClick={() => setUploaderOpen((open) => !open)}
          aria-expanded={uploaderOpen}
          className="focus-ring flex w-full items-center justify-between rounded-md text-left"
        >
          <span className="font-display text-lg font-medium tracking-wide text-parchment-100">
            Ladda upp ljud
          </span>
          <span className="text-xs text-muted-foreground">{uploaderOpen ? "Dölj" : "Visa"}</span>
        </button>
        {uploaderOpen && (
          <div className="mt-3">
            <AudioUploader />
          </div>
        )}
      </section>

      <nav aria-label="Vidare" className="flex flex-wrap gap-2">
        <Link
          href="/scenes"
          className="focus-ring flex items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm text-parchment-200 transition hover:border-ember-400/40 hover:text-ember-300"
        >
          <ScenesIcon className="h-4 w-4 flex-none" />
          Alla scener
        </Link>
        <Link
          href="/library"
          className="focus-ring flex items-center gap-2 rounded-lg border border-border-strong px-3 py-2 text-sm text-parchment-200 transition hover:border-ember-400/40 hover:text-ember-300"
        >
          <LibraryIcon className="h-4 w-4 flex-none" />
          Ljudbibliotek
        </Link>
      </nav>
    </div>
  );
}
