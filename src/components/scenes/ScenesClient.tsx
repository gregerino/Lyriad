"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { Scene } from "@/types/domain";

type SceneListItem = Pick<Scene, "id" | "name" | "description" | "createdAt" | "updatedAt">;

export function ScenesClient() {
  const router = useRouter();
  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [creating, setCreating] = useState(false);
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
  }, []);

  async function createScene() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setCreating(true);
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
      setCreating(false);
    }
  }

  async function deleteScene(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/scenes/${id}`, { method: "DELETE" });
      if (!res.ok) return;
      setScenes((prev) => prev.filter((s) => s.id !== id));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 bg-zinc-950 px-6 py-12 text-zinc-50">
      <h1 className="text-2xl font-semibold tracking-tight">Scener</h1>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-sm font-medium text-zinc-200">Ny scen</h2>
        <div className="mt-3 flex flex-col gap-2">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Namn, t.ex. Krogen i Silverbäcken"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
          />
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Beskrivning (valfritt)"
            className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void createScene()}
            disabled={!name.trim() || creating}
            className="self-start rounded-md bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-40"
          >
            {creating ? "Skapar…" : "Skapa scen"}
          </button>
          {createError && <p className="text-xs text-red-400">{createError}</p>}
        </div>
      </div>

      {loading && <p className="text-sm text-zinc-400">Laddar…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {!loading && !error && scenes.length === 0 && (
        <p className="text-sm text-zinc-500">Inga scener än — skapa din första ovan.</p>
      )}

      <div className="flex flex-col gap-2">
        {scenes.map((scene) => (
          <div
            key={scene.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
          >
            <Link href={`/scenes/${scene.id}`} className="flex-1">
              <p className="text-sm font-medium text-zinc-100">{scene.name}</p>
              {scene.description && (
                <p className="mt-0.5 text-xs text-zinc-500">{scene.description}</p>
              )}
            </Link>
            <button
              type="button"
              onClick={() => void deleteScene(scene.id)}
              disabled={deletingId === scene.id}
              className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-40"
            >
              {deletingId === scene.id ? "Tar bort…" : "Ta bort"}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
