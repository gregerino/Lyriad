"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { FavoriteScenesBar } from "@/components/scenes/FavoriteScenesBar";
import { Slider } from "@/components/ui/Slider";
import { PlayIcon, SpeakerOnIcon } from "@/components/ui/icons";

const MUSIC_SLOT_COUNT = 10;
const ONESHOT_SLOT_COUNT = 20;

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
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember-400">Lyriad</p>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-wide text-parchment-100 sm:text-3xl">
          Mixer
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Ingen scen laddad.</p>
      </div>

      <FavoriteScenesBar />

      <div className="rounded-lg border border-ember-400/40 bg-surface p-4 shadow-sm">
        <p className="text-sm font-medium text-parchment-100">Skapa en ny scen</p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-start">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createScene();
            }}
            placeholder="Namn, t.ex. Krogen i Silverbäcken"
            className="flex-1 rounded-md border border-border-strong bg-background px-3 py-1.5 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400 focus:outline-none"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createScene();
            }}
            placeholder="Beskrivning (valfritt)"
            className="flex-1 rounded-md border border-border-strong bg-background px-3 py-1.5 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void createScene()}
            disabled={!name.trim() || submitting}
            className="rounded-md bg-gradient-to-b from-ember-400 to-ember-500 px-4 py-1.5 text-sm font-medium text-ink-950 shadow-sm transition hover:shadow-glow-sm disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
          >
            {submitting ? "Skapar…" : "Skapa scen"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-wine-400">{error}</p>}
      </div>

      <section className="rounded-lg border border-border bg-surface p-4 shadow-xs">
        <button
          type="button"
          onClick={() => setUploaderOpen((open) => !open)}
          aria-expanded={uploaderOpen}
          className="flex w-full items-center justify-between text-left"
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

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-medium tracking-wide text-parchment-100">
            Musik
          </h2>
          <span className="font-mono text-xs text-muted-foreground">0/{MUSIC_SLOT_COUNT} platser</span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-ember-500/25 bg-gradient-to-r from-ember-950/50 to-surface p-4 opacity-60 shadow-sm">
          <button
            type="button"
            disabled
            aria-label="Ingen scen laddad"
            className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-gradient-to-b from-ember-400 to-ember-500 text-ink-950 shadow-glow-sm disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
          >
            <PlayIcon className="h-5 w-5 translate-x-0.5" />
          </button>

          <div className="min-w-max flex-none">
            <p className="text-sm font-medium text-parchment-100">Master</p>
            <p className="text-xs text-muted-foreground">Ingen scen laddad</p>
          </div>

          <div className="flex flex-1 items-center gap-3 sm:max-w-xs">
            <SpeakerOnIcon className="h-4 w-4 flex-none text-muted-foreground" />
            <Slider value={0} onChange={() => {}} disabled className="w-full" aria-label="Mastervolym" />
            <span className="w-10 flex-none text-right font-mono text-xs text-muted-foreground">0%</span>
          </div>
        </div>

        <div className="mt-3 grid grid-flow-col grid-cols-2 grid-rows-5 gap-3">
          {Array.from({ length: MUSIC_SLOT_COUNT }, (_, i) => (
            <div
              key={i}
              className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 opacity-50 shadow-xs"
            >
              <span className="font-mono text-xs text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="min-h-[2.25rem] text-xs text-muted-foreground">
                Skapa en scen för att tilldela ljud
              </p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-medium tracking-wide text-parchment-100">
            One-shots
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            0/{ONESHOT_SLOT_COUNT} platser
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {Array.from({ length: ONESHOT_SLOT_COUNT }, (_, i) => (
            <div
              key={i}
              className="flex aspect-[3/2] flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border-strong/70 p-2 text-center opacity-50"
            >
              <span className="text-[10px] font-medium text-muted-foreground">
                {String(i + 1).padStart(2, "0")}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
