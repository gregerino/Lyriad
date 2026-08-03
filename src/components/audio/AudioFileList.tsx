"use client";

import { useMemo, useState } from "react";
import { AUDIO_CATEGORIES, AUDIO_CATEGORY_LABELS, formatBytes } from "@/lib/audio/limits";
import type { AudioCategory, AudioFileWithMeta, Collection } from "@/types/domain";

type TypeFilter = "all" | AudioCategory;

type AudioFileListProps = {
  files: AudioFileWithMeta[];
  collections: Collection[];
  /** Called after anything that changes what the server holds. */
  onChanged: () => void;
};

/**
 * The flat list under the browse rows: every uploaded file, with the controls
 * for filing it — its mixer type, and which collections it belongs to. Marking
 * several files and dropping them into a collection in one go is the fast path
 * for a fresh library, so selection lives here rather than on each card.
 */
export function AudioFileList({ files, collections, onChanged }: AudioFileListProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [onlyUnfiled, setOnlyUnfiled] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTargetCollection, setBulkTargetCollection] = useState<string>("");

  const collectionsById = useMemo(
    () => new Map(collections.map((c) => [c.id, c])),
    [collections]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return files.filter((file) => {
      if (typeFilter !== "all" && file.category !== typeFilter) return false;
      if (onlyUnfiled && file.collectionIds.length > 0) return false;
      if (q && !file.filename.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [files, search, typeFilter, onlyUnfiled]);

  const unfiledCount = useMemo(
    () => files.filter((f) => f.collectionIds.length === 0).length,
    [files]
  );
  const isFiltered = search.trim() !== "" || typeFilter !== "all" || onlyUnfiled;

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function updateFileType(id: string, category: AudioCategory | null) {
    const res = await fetch(`/api/audio-files/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ category }),
    });
    if (!res.ok) return;
    onChanged();
  }

  async function addSelectionToCollection() {
    if (selectedIds.size === 0 || !bulkTargetCollection) return;
    const res = await fetch(`/api/collections/${bulkTargetCollection}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ add: Array.from(selectedIds) }),
    });
    if (!res.ok) return;
    setSelectedIds(new Set());
    onChanged();
  }

  async function removeFromCollection(fileId: string, collectionId: string) {
    const res = await fetch(`/api/collections/${collectionId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ remove: [fileId] }),
    });
    if (!res.ok) return;
    onChanged();
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-6">
      <div className="flex flex-wrap items-baseline gap-3">
        <h2 className="font-display text-lg font-medium tracking-wide text-parchment-100">
          Alla ljud
        </h2>
        <span className="font-mono text-xs text-muted-foreground">
          {files.length} {files.length === 1 ? "fil" : "filer"}
          {unfiledCount > 0 && ` · ${unfiledCount} utan samling`}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Sök på filnamn…"
          className="focus-ring min-w-[14rem] flex-1 rounded-md border border-border-strong bg-surface px-3 py-1.5 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
        />
        <div className="flex flex-wrap items-center gap-1 text-xs">
          <button
            type="button"
            onClick={() => setTypeFilter("all")}
            className={`focus-ring rounded-md border px-2.5 py-1 transition ${
              typeFilter === "all"
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
              onClick={() => setTypeFilter(c)}
              className={`focus-ring rounded-md border px-2.5 py-1 transition ${
                typeFilter === c
                  ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                  : "border-border-strong text-parchment-300 hover:border-ember-400/40"
              }`}
            >
              {AUDIO_CATEGORY_LABELS[c]}
            </button>
          ))}
          <label className="ml-1 flex items-center gap-1.5 rounded-md border border-border-strong px-2.5 py-1 text-parchment-300">
            <input
              type="checkbox"
              checked={onlyUnfiled}
              onChange={(e) => setOnlyUnfiled(e.target.checked)}
              className="focus-ring lyriad-checkbox h-3.5 w-3.5 flex-none"
            />
            Utan samling
          </label>
        </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-ember-400/40 bg-surface p-3 shadow-sm">
          <span className="text-sm text-parchment-100">
            {selectedIds.size} {selectedIds.size === 1 ? "fil markerad" : "filer markerade"}
          </span>
          <select
            value={bulkTargetCollection}
            onChange={(e) => setBulkTargetCollection(e.target.value)}
            className="focus-ring rounded-md border border-border-strong bg-background px-2.5 py-1.5 text-xs text-parchment-100 focus:border-ember-400"
          >
            <option value="">Välj samling…</option>
            {collections.map((collection) => (
              <option key={collection.id} value={collection.id}>
                {collection.category ? `${collection.category} · ${collection.name}` : collection.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void addSelectionToCollection()}
            disabled={!bulkTargetCollection}
            className="focus-ring rounded-md border border-border-strong px-3 py-1.5 text-xs text-parchment-200 transition hover:border-ember-400/60 hover:text-ember-300 disabled:opacity-40"
          >
            Lägg till i samling
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            className="focus-ring ml-auto rounded-sm text-xs text-muted-foreground transition hover:text-parchment-100"
          >
            Avmarkera alla
          </button>
        </div>
      )}

      {files.length === 0 && (
        <p className="rounded-lg border border-dashed border-border-strong/70 bg-surface/50 px-4 py-6 text-center text-sm text-muted-foreground">
          Inga ljudfiler ännu — ladda upp din första med uppladdningsknappen ovan.
        </p>
      )}

      {files.length > 0 && filtered.length === 0 && (
        <p className="text-sm text-muted-foreground">
          {isFiltered ? "Inga ljudfiler matchar filtret." : "Inga ljudfiler att visa."}
        </p>
      )}

      <div className="flex flex-col gap-2">
        {filtered.map((file) => (
          <div
            key={file.id}
            className="flex items-start gap-3 rounded-lg border border-border bg-surface p-3 shadow-xs transition hover:border-border-strong"
          >
            <input
              type="checkbox"
              checked={selectedIds.has(file.id)}
              onChange={() => toggleSelected(file.id)}
              aria-label={`Markera ${file.filename}`}
              className="focus-ring lyriad-checkbox mt-1 h-3.5 w-3.5 flex-none"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-sm font-medium text-parchment-100">{file.filename}</p>
                <span className="flex-none font-mono text-xs text-muted-foreground">
                  {formatBytes(file.sizeBytes)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={file.category ?? ""}
                  aria-label={`Typ för ${file.filename}`}
                  onChange={(e) =>
                    void updateFileType(
                      file.id,
                      e.target.value ? (e.target.value as AudioCategory) : null
                    )
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
                      onClick={() => void removeFromCollection(file.id, collectionId)}
                      aria-label={`Ta bort ${file.filename} från ${
                        collectionsById.get(collectionId)?.name ?? "samlingen"
                      }`}
                      className="focus-ring rounded-full text-muted-foreground transition hover:text-danger-foreground"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {file.collectionIds.length === 0 && (
                  <span className="text-xs text-muted-foreground">Utan samling</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
