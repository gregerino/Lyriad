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

  const isFiltered = search.trim() !== "" || categoryFilter !== "all" || collectionFilter !== "all";

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
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember-400">Lyriad</p>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-wide text-parchment-100 sm:text-3xl">
          Ljudbibliotek
        </h1>
      </div>

      <AudioUploader onUploaded={() => void loadAll()} />

      <div className="rounded-lg border border-border bg-surface p-4 shadow-xs">
        <h2 className="text-sm font-medium text-parchment-100">Samlingar</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setCollectionFilter("all")}
            className={`focus-ring rounded-md border px-2.5 py-1 text-xs transition ${
              collectionFilter === "all"
                ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                : "border-border-strong text-parchment-300 hover:border-ember-400/40"
            }`}
          >
            Alla filer
          </button>
          {collections.map((collection) => (
            <span key={collection.id} className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setCollectionFilter(collection.id)}
                className={`focus-ring rounded-md border px-2.5 py-1 text-xs transition ${
                  collectionFilter === collection.id
                    ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                    : "border-border-strong text-parchment-300 hover:border-ember-400/40"
                }`}
              >
                {collection.name} ({collectionFileCounts.get(collection.id) ?? 0})
              </button>
              <button
                type="button"
                onClick={() => void deleteCollection(collection.id)}
                className="focus-ring rounded-full text-xs text-muted-foreground transition hover:text-danger-foreground"
                aria-label={`Ta bort samlingen ${collection.name}`}
              >
                ×
              </button>
            </span>
          ))}
          {collections.length === 0 && (
            <span className="text-xs text-muted-foreground">Inga samlingar ännu.</span>
          )}
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
            className="focus-ring flex-1 rounded-md border border-border-strong bg-background px-2.5 py-1.5 text-xs text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
          />
          <button
            type="button"
            onClick={() => void createCollection()}
            className="focus-ring rounded-md border border-border-strong px-2.5 py-1.5 text-xs text-parchment-200 transition hover:border-ember-400/60 hover:text-ember-300"
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
          className="focus-ring min-w-[16rem] flex-1 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
        />
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setCategoryFilter("all")}
            className={`focus-ring rounded-md border px-2.5 py-1 transition ${
              categoryFilter === "all"
                ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                : "border-border-strong text-parchment-300 hover:border-ember-400/40"
            }`}
          >
            Alla typer
          </button>
          {AUDIO_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategoryFilter(c)}
              className={`focus-ring rounded-md border px-2.5 py-1 transition ${
                categoryFilter === c
                  ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                  : "border-border-strong text-parchment-300 hover:border-ember-400/40"
              }`}
            >
              {AUDIO_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-col gap-3 rounded-lg border border-ember-400/40 bg-surface p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm">
            <span className="text-parchment-100">{selectedIds.size} filer markerade</span>
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="focus-ring rounded-sm text-xs text-muted-foreground hover:text-parchment-100"
            >
              Avmarkera alla
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={bulkTargetCollection}
              onChange={(e) => setBulkTargetCollection(e.target.value)}
              className="focus-ring rounded-md border border-border-strong bg-background px-2.5 py-1.5 text-xs text-parchment-100 focus:border-ember-400"
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
              className="focus-ring rounded-md border border-border-strong px-3 py-1.5 text-xs text-parchment-200 transition hover:border-ember-400/60 hover:text-ember-300 disabled:opacity-40"
            >
              Lägg till markerade i samling
            </button>
          </div>
        </div>
      )}

      {loading && <p className="text-sm text-muted-foreground">Laddar…</p>}
      {error && <p className="text-sm text-danger-foreground">{error}</p>}

      {!loading && !error && audioFiles.length === 0 && (
        <p className="rounded-lg border border-dashed border-border-strong/70 bg-surface/50 px-4 py-6 text-center text-sm text-muted-foreground">
          Inga ljudfiler ännu — ladda upp din första ovan.
        </p>
      )}

      {!loading && !error && audioFiles.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {isFiltered
            ? "Inga ljudfiler matchar filtret."
            : "Inga ljudfiler att visa."}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((file) => (
          <div
            key={file.id}
            className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-xs transition hover:border-border-strong"
          >
            <div className="flex items-start gap-3">
              <input
                type="checkbox"
                checked={selectedIds.has(file.id)}
                onChange={() => toggleSelected(file.id)}
                aria-label={`Markera ${file.filename}`}
                className="focus-ring lyriad-checkbox mt-1 h-3.5 w-3.5 flex-none"
              />
              <div className="flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium text-parchment-100">{file.filename}</p>
                  <span className="flex-none font-mono text-xs text-muted-foreground">
                    {formatBytes(file.sizeBytes)}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <select
                    value={file.category ?? ""}
                    onChange={(e) =>
                      void updateFile(file.id, {
                        category: e.target.value ? (e.target.value as AudioCategory) : null,
                      })
                    }
                    className="focus-ring rounded-md border border-border-strong bg-background px-2 py-1 text-xs text-parchment-100 focus:border-ember-400"
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
                      className="flex items-center gap-1 rounded-full bg-surface-elevated px-2 py-0.5 text-xs text-parchment-300"
                    >
                      {collectionsById.get(collectionId)?.name ?? "Okänd samling"}
                      <button
                        type="button"
                        onClick={() => void removeFileFromCollection(file.id, collectionId)}
                        className="focus-ring rounded-full text-muted-foreground transition hover:text-danger-foreground"
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
