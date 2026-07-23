"use client";

import { useEffect, useMemo, useState } from "react";
import { AUDIO_CATEGORIES, AUDIO_CATEGORY_LABELS, formatBytes } from "@/lib/audio/limits";
import type { AudioCategory, AudioFileWithMeta, Collection } from "@/types/domain";
import { AudioUploader } from "./AudioUploader";

type CategoryFilter = "all" | AudioCategory;

export function LibraryClient() {
  const [audioFiles, setAudioFiles] = useState<AudioFileWithMeta[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>("all");
  const [collectionFilter, setCollectionFilter] = useState<string>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [newCollectionName, setNewCollectionName] = useState("");
  const [bulkTargetCollection, setBulkTargetCollection] = useState<string>("");

  async function loadAll() {
    setError(null);
    try {
      const [filesRes, collectionsRes] = await Promise.all([
        fetch("/api/audio-files"),
        fetch("/api/collections"),
      ]);
      if (!filesRes.ok || !collectionsRes.ok) throw new Error("Kunde inte ladda biblioteket");
      const { audioFiles: files } = await filesRes.json();
      const { collections: cols } = await collectionsRes.json();
      setAudioFiles(files);
      setCollections(cols);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte ladda biblioteket");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount, no external subscription to hang this off
    void loadAll();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return audioFiles.filter((file) => {
      if (categoryFilter !== "all" && file.category !== categoryFilter) return false;
      if (collectionFilter !== "all" && !file.collectionIds.includes(collectionFilter)) {
        return false;
      }
      if (q && !file.filename.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [audioFiles, search, categoryFilter, collectionFilter]);

  const collectionFileCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of audioFiles) {
      for (const collectionId of file.collectionIds) {
        counts.set(collectionId, (counts.get(collectionId) ?? 0) + 1);
      }
    }
    return counts;
  }, [audioFiles]);

  const collectionsById = useMemo(() => new Map(collections.map((c) => [c.id, c])), [collections]);

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function updateFile(id: string, patch: { category?: AudioCategory | null }) {
    const res = await fetch(`/api/audio-files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const { audioFile } = await res.json();
    setAudioFiles((prev) =>
      prev.map((f) => (f.id === id ? { ...f, ...audioFile } : f))
    );
  }

  async function addSelectionToCollection() {
    if (selectedIds.size === 0 || !bulkTargetCollection) return;
    const res = await fetch(`/api/collections/${bulkTargetCollection}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add: Array.from(selectedIds) }),
    });
    if (!res.ok) return;
    await loadAll();
  }

  async function removeFileFromCollection(fileId: string, collectionId: string) {
    const res = await fetch(`/api/collections/${collectionId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remove: [fileId] }),
    });
    if (!res.ok) return;
    await loadAll();
  }

  async function createCollection() {
    const name = newCollectionName.trim();
    if (!name) return;
    const res = await fetch("/api/collections", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (!res.ok) return;
    setNewCollectionName("");
    await loadAll();
  }

  async function deleteCollection(id: string) {
    const res = await fetch(`/api/collections/${id}`, { method: "DELETE" });
    if (!res.ok) return;
    if (collectionFilter === id) setCollectionFilter("all");
    await loadAll();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 bg-zinc-950 px-6 py-12 text-zinc-50">
      <h1 className="text-2xl font-semibold tracking-tight">Ljudbibliotek</h1>

      <AudioUploader onUploaded={() => void loadAll()} />

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-sm font-medium text-zinc-200">Samlingar</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCollectionFilter("all")}
            className={`rounded-md border px-2.5 py-1 text-xs ${
              collectionFilter === "all"
                ? "border-amber-400 text-amber-400"
                : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            Alla filer
          </button>
          {collections.map((collection) => (
            <span key={collection.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCollectionFilter(collection.id)}
                className={`rounded-md border px-2.5 py-1 text-xs ${
                  collectionFilter === collection.id
                    ? "border-amber-400 text-amber-400"
                    : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
                }`}
              >
                {collection.name} ({collectionFileCounts.get(collection.id) ?? 0})
              </button>
              <button
                type="button"
                onClick={() => void deleteCollection(collection.id)}
                className="text-xs text-zinc-500 hover:text-red-400"
                aria-label={`Ta bort samlingen ${collection.name}`}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="text"
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void createCollection();
            }}
            placeholder="Ny samling, t.ex. Vinterfestens kampanj"
            className="flex-1 rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={() => void createCollection()}
            className="rounded-md border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-200 hover:border-amber-400"
          >
            Skapa
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sök på filnamn…"
          className="min-w-[16rem] flex-1 rounded-md border border-zinc-700 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-amber-400 focus:outline-none"
        />
        <div className="flex items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`rounded-md border px-2.5 py-1 ${
              categoryFilter === "all"
                ? "border-amber-400 text-amber-400"
                : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
            }`}
          >
            Alla typer
          </button>
          {AUDIO_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoryFilter(c)}
              className={`rounded-md border px-2.5 py-1 ${
                categoryFilter === c
                  ? "border-amber-400 text-amber-400"
                  : "border-zinc-700 text-zinc-300 hover:border-zinc-500"
              }`}
            >
              {AUDIO_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-amber-400/40 bg-zinc-900 p-4">
          <div className="flex items-center justify-between text-sm">
            <span>{selectedIds.size} filer markerade</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="text-xs text-zinc-400 hover:text-zinc-200"
            >
              Avmarkera alla
            </button>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={bulkTargetCollection}
              onChange={(e) => setBulkTargetCollection(e.target.value)}
              className="rounded-md border border-zinc-700 bg-zinc-950 px-2.5 py-1.5 text-xs text-zinc-100"
            >
              <option value="">Välj samling…</option>
              {collections.map((collection) => (
                <option key={collection.id} value={collection.id}>
                  {collection.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => void addSelectionToCollection()}
              disabled={!bulkTargetCollection}
              className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-200 hover:border-amber-400 disabled:opacity-40"
            >
              Lägg till markerade i samling
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-zinc-400">Laddar…</p>}
      {error && <p className="text-sm text-red-400">{error}</p>}

      {!loading && filtered.length === 0 && (
        <p className="text-sm text-zinc-500">Inga ljudfiler matchar filtret.</p>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((file) => (
          <div
            key={file.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3"
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(file.id)}
                onChange={() => toggleSelected(file.id)}
                className="mt-1"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-zinc-100">{file.filename}</p>
                  <span className="text-xs text-zinc-500">{formatBytes(file.sizeBytes)}</span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={file.category ?? ""}
                    onChange={(e) =>
                      void updateFile(file.id, {
                        category: e.target.value ? (e.target.value as AudioCategory) : null,
                      })
                    }
                    className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100"
                  >
                    <option value="">Ingen typ</option>
                    {AUDIO_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {AUDIO_CATEGORY_LABELS[c]}
                      </option>
                    ))}
                  </select>
                  {file.collectionIds.map((collectionId) => (
                    <span
                      key={collectionId}
                      className="flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-300"
                    >
                      {collectionsById.get(collectionId)?.name ?? "Okänd samling"}
                      <button
                        type="button"
                        onClick={() => void removeFileFromCollection(file.id, collectionId)}
                        className="text-zinc-500 hover:text-red-400"
                        aria-label="Ta bort från samling"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
