"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type MouseEvent } from "react";
import { PlusIcon, StarIcon, XIcon } from "@/components/ui/icons";
import { LAST_SCENE_COOKIE } from "@/lib/lastScene";
import type { Scene } from "@/types/domain";

type SceneListItem = Pick<
  Scene,
  "id" | "name" | "description" | "favorite" | "createdAt" | "updatedAt"
>;

function readLastSceneId(): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${LAST_SCENE_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

export function ScenesClient() {
  const router = useRouter();
  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [lastSceneId, setLastSceneId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function loadScenes() {
    setError(null);
    try {
      const res = await fetch("/api/scenes");
      if (!res.ok) throw new Error("Kunde inte ladda scener");
      const { scenes: rows } = await res.json();
      setScenes(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte ladda scener");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount, no external subscription to hang this off
    void loadScenes();
    setLastSceneId(readLastSceneId());
  }, []);

  function startCreating() {
    setCreating(true);
    setCreateError(null);
  }

  function cancelCreating() {
    setCreating(false);
    setName("");
    setDescription("");
    setCreateError(null);
  }

  async function createScene() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSubmitting(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmedName,
          description: description.trim() || null,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Kunde inte skapa scenen");
      }
      const { scene } = await res.json();
      router.push(`/scenes/${scene.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Kunde inte skapa scenen");
      setSubmitting(false);
    }
  }

  async function deleteScene(e: MouseEvent, id: string) {
    e.preventDefault();
    e.stopPropagation();
    setDeletingId(id);
    try {
      const res = await fetch(`/api/scenes/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setScenes((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  async function toggleFavorite(e: MouseEvent, id: string, current: boolean) {
    e.preventDefault();
    e.stopPropagation();
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, favorite: !current } : s)));
    const res = await fetch(`/api/scenes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !current }),
    });
    if (!res.ok) {
      setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, favorite: current } : s)));
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember-400">Lyriad</p>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-wide text-parchment-100 sm:text-3xl">
          Scener
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Bläddra bland dina scener, eller skapa en ny.
        </p>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Laddar…</p>}
      {error && <p className="text-sm text-danger-foreground">{error}</p>}

      {!loading && !error && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {creating ? (
            <div className="flex min-h-[9.5rem] flex-col gap-2 rounded-lg border border-ember-400/40 bg-surface p-4 shadow-sm">
              <input
                type="text"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") cancelCreating();
                }}
                placeholder="Namn, t.ex. Krogen i Silverbäcken"
                className="focus-ring rounded-md border border-border-strong bg-background px-3 py-1.5 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
              />
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createScene();
                  if (e.key === "Escape") cancelCreating();
                }}
                placeholder="Beskrivning (valfritt)"
                className="focus-ring rounded-md border border-border-strong bg-background px-3 py-1.5 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
              />
              {createError && <p className="text-xs text-danger-foreground">{createError}</p>}
              <div className="mt-auto flex items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => void createScene()}
                  disabled={!name.trim() || submitting}
                  className="focus-ring rounded-md bg-gradient-to-b from-ember-400 to-ember-500 px-3 py-1.5 text-sm font-medium text-ink-950 shadow-sm transition hover:shadow-glow-sm disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
                >
                  {submitting ? "Skapar…" : "Skapa scen"}
                </button>
                <button
                  type="button"
                  onClick={cancelCreating}
                  disabled={submitting}
                  className="focus-ring rounded-md px-3 py-1.5 text-sm font-medium text-parchment-400 transition hover:text-ember-300 disabled:opacity-40"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={startCreating}
              className="focus-ring flex min-h-[9.5rem] flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border-strong text-muted-foreground transition hover:border-ember-400/50 hover:text-ember-300"
            >
              <PlusIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Ny scen</span>
            </button>
          )}

          {scenes.map((scene) => {
            const isLastUsed = scene.id === lastSceneId;
            return (
              <div
                key={scene.id}
                className="group relative rounded-lg border border-border bg-surface shadow-sm transition hover:border-ember-400/40 hover:shadow-md"
              >
                <Link
                  href={`/scenes/${scene.id}`}
                  className="focus-ring flex min-h-[9.5rem] flex-col gap-2 rounded-lg p-4 pr-14"
                >
                  <p className="font-display text-lg font-medium tracking-wide text-parchment-100">
                    {scene.name}
                  </p>
                  {scene.description && (
                    <p className="line-clamp-3 text-sm text-muted-foreground">
                      {scene.description}
                    </p>
                  )}
                  {isLastUsed && (
                    <span className="mt-auto inline-flex w-fit items-center gap-1 rounded-full border border-ember-400/40 bg-ember-400/10 px-2 py-0.5 text-[11px] font-medium text-ember-300">
                      Senast använd
                    </span>
                  )}
                </Link>
                <div className="absolute right-3 top-4 flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={(e) => void toggleFavorite(e, scene.id, scene.favorite)}
                    aria-label={
                      scene.favorite ? `Ta bort ${scene.name} som favorit` : `Gör ${scene.name} till favorit`
                    }
                    title={scene.favorite ? "Ta bort som favorit" : "Gör till favorit"}
                    className={`focus-ring flex-none rounded-full transition focus-visible:opacity-100 ${
                      scene.favorite
                        ? "text-ember-400 hover:text-ember-300"
                        : "text-muted-foreground/60 opacity-0 group-hover:opacity-100 hover:text-ember-300"
                    }`}
                  >
                    <StarIcon className="h-4 w-4" filled={scene.favorite} />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => void deleteScene(e, scene.id)}
                    disabled={deletingId === scene.id}
                    aria-label={`Ta bort ${scene.name}`}
                    title="Ta bort scen"
                    className="focus-ring flex-none rounded-full text-muted-foreground/80 opacity-0 transition group-hover:opacity-100 focus-visible:opacity-100 hover:text-wine-400 disabled:opacity-40"
                  >
                    <XIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}

          {scenes.length === 0 && !creating && (
            <p className="col-span-full text-sm text-muted-foreground">
              Inga scener än — skapa din första ovan.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
