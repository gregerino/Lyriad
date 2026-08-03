"use client";

import { useMemo, useState } from "react";
import { AUDIO_CATEGORY_LABELS, formatBytes } from "@/lib/audio/limits";
import type { AudioCategory, AudioFileWithMeta, Collection } from "@/types/domain";

/** Stands in for "files that belong to no collection" as a filter value. */
const UNFILED = "__utan_samling__";

type AudioFilePickerProps = {
  files: AudioFileWithMeta[];
  collections: Collection[];
  /**
   * Files filed under this category are offered first. The rest stay in the
   * list rather than being filtered out: a slot can hold any sound, and a file
   * silently missing from the picker because of how it was tagged is a puzzle
   * with no visible pieces.
   */
  preferredCategory: AudioCategory;
  disabled?: boolean;
  onSelect: (audioFileId: string) => void;
};

/**
 * Picks a sound for a slot. A bare <select> of every filename works right up
 * until the library outgrows one screen — and the collections and categories
 * built in the library are worth nothing if the one place that needs them
 * can't see them, so the same search-and-filter the library offers lives here.
 */
export function AudioFilePicker({
  files,
  collections,
  preferredCategory,
  disabled,
  onSelect,
}: AudioFilePickerProps) {
  const [search, setSearch] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");

  const sortedCollections = useMemo(
    () =>
      [...collections].sort((a, b) =>
        `${a.category ?? ""}${a.name}`.localeCompare(`${b.category ?? ""}${b.name}`, "sv")
      ),
    [collections]
  );

  const { preferred, others } = useMemo(() => {
    const query = search.trim().toLowerCase();
    const matching = files.filter((file) => {
      if (query && !file.filename.toLowerCase().includes(query)) return false;
      if (collectionFilter === UNFILED) return file.collectionIds.length === 0;
      if (collectionFilter) return file.collectionIds.includes(collectionFilter);
      return true;
    });
    return {
      preferred: matching.filter((f) => f.category === preferredCategory || f.category === null),
      others: matching.filter((f) => f.category !== preferredCategory && f.category !== null),
    };
  }, [files, search, collectionFilter, preferredCategory]);

  const total = preferred.length + others.length;

  if (files.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Inga ljud i biblioteket ännu — ladda upp ett nedan.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Sök på filnamn…"
        aria-label="Sök bland ljudfiler"
        className="focus-ring rounded-md border border-border-strong bg-background px-2 py-1.5 text-xs text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
      />

      {sortedCollections.length > 0 && (
        <select
          value={collectionFilter}
          onChange={(e) => setCollectionFilter(e.target.value)}
          aria-label="Filtrera på samling"
          className="focus-ring rounded-md border border-border-strong bg-background px-2 py-1.5 text-xs text-parchment-100 focus:border-ember-400"
        >
          <option value="">Alla samlingar</option>
          {sortedCollections.map((collection) => (
            <option key={collection.id} value={collection.id}>
              {collection.category
                ? `${collection.category} · ${collection.name}`
                : collection.name}
            </option>
          ))}
          <option value={UNFILED}>Utan samling</option>
        </select>
      )}

      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
        {preferred.map((file) => (
          <FileRow key={file.id} file={file} disabled={disabled} onSelect={onSelect} />
        ))}

        {others.length > 0 && (
          <>
            {/* Only worth a divider once there is something above it to divide from. */}
            <p
              className={`px-1.5 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground ${
                preferred.length > 0 ? "mt-2 border-t border-border pt-2" : ""
              }`}
            >
              Andra typer
            </p>
            {others.map((file) => (
              <FileRow key={file.id} file={file} disabled={disabled} onSelect={onSelect} />
            ))}
          </>
        )}

        {total === 0 && (
          <p className="px-1.5 py-1 text-xs text-muted-foreground">
            Inga ljud matchar sökningen.
          </p>
        )}
      </div>
    </div>
  );
}

function FileRow({
  file,
  disabled,
  onSelect,
}: {
  file: AudioFileWithMeta;
  disabled?: boolean;
  onSelect: (audioFileId: string) => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onSelect(file.id)}
      title={file.filename}
      className="focus-ring flex w-full flex-col items-start gap-0.5 rounded-md px-1.5 py-1.5 text-left transition hover:bg-ink-700 disabled:cursor-not-allowed disabled:opacity-40"
    >
      <span className="w-full truncate text-xs text-parchment-100">{file.filename}</span>
      <span className="font-mono text-[11px] text-muted-foreground">
        {file.category ? `${AUDIO_CATEGORY_LABELS[file.category]} · ` : ""}
        {formatBytes(file.sizeBytes)}
      </span>
    </button>
  );
}
