"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AudioFileList } from "@/components/audio/AudioFileList";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { CollectionArtwork } from "@/components/audio/CollectionArtwork";
import { CardCarousel } from "@/components/ui/CardCarousel";
import { Popover } from "@/components/ui/Popover";
import { Tooltip } from "@/components/ui/Tooltip";
import { PlusIcon, UploadIcon } from "@/components/ui/icons";
import type { AudioFileWithMeta, Collection } from "@/types/domain";

/** Stands in for "no category" as a map key — collections may have none. */
const UNCATEGORISED = "__utan_kategori__";

type CollectionGroup = {
  key: string;
  label: string;
  collections: Collection[];
};

export function LibraryClient() {
  const [audioFiles, setAudioFiles] = useState<AudioFileWithMeta[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeCategory, setActiveCategory] = useState<string | null>(null);

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

  const fileCountByCollection = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of audioFiles) {
      for (const collectionId of file.collectionIds) {
        counts.set(collectionId, (counts.get(collectionId) ?? 0) + 1);
      }
    }
    return counts;
  }, [audioFiles]);

  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const collection of collections) {
      if (collection.category) names.add(collection.category);
    }
    return Array.from(names).sort((a, b) => a.localeCompare(b, "sv"));
  }, [collections]);

  const groups = useMemo<CollectionGroup[]>(() => {
    const byCategory = new Map<string, Collection[]>();
    for (const collection of collections) {
      const key = collection.category ?? UNCATEGORISED;
      const existing = byCategory.get(key);
      if (existing) existing.push(collection);
      else byCategory.set(key, [collection]);
    }

    const categorised = categories.map((category) => ({
      key: category,
      label: category,
      collections: byCategory.get(category) ?? [],
    }));
    const loose = byCategory.get(UNCATEGORISED);
    return loose
      ? [...categorised, { key: UNCATEGORISED, label: "Utan kategori", collections: loose }]
      : categorised;
  }, [collections, categories]);

  // A category that disappears — renamed away, or its last collection deleted —
  // would otherwise leave the page filtered down to nothing.
  const effectiveCategory =
    activeCategory && groups.some((g) => g.key === activeCategory) ? activeCategory : null;
  const visibleGroups = effectiveCategory
    ? groups.filter((group) => group.key === effectiveCategory)
    : groups;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember-400">Lyriad</p>
          <h1 className="mt-1 font-display text-2xl font-medium tracking-wide text-parchment-100 sm:text-3xl">
            Ljudbibliotek
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Samlingar av ljud, sorterade under egna kategorier.
          </p>
        </div>

        <div className="flex flex-none items-center gap-2">
          <NewCollectionButton
            categories={categories}
            defaultCategory={effectiveCategory === UNCATEGORISED ? null : effectiveCategory}
            onCreated={() => void loadAll()}
          />

          <Popover
            panelClassName="w-80 max-w-[calc(100vw-2rem)]"
            trigger={({ open, toggle }) => (
              <Tooltip label="Ladda upp ljud" align="end">
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={open}
                  aria-label="Ladda upp ljud"
                  className={`focus-ring flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                    open
                      ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                      : "border-border-strong text-muted-foreground hover:border-ember-400/40 hover:text-ember-300"
                  }`}
                >
                  <UploadIcon className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
          >
            <AudioUploader onUploaded={() => void loadAll()} />
          </Popover>
        </div>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Laddar…</p>}
      {error && <p className="text-sm text-danger-foreground">{error}</p>}

      {!loading && !error && (
        <>
          {categories.length > 0 && (
            <section className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-display text-lg font-medium tracking-wide text-parchment-100">
                  Kategorier
                </h2>
                {effectiveCategory && (
                  <button
                    type="button"
                    onClick={() => setActiveCategory(null)}
                    className="focus-ring rounded-md px-2 py-1 text-xs text-ember-300 transition hover:text-ember-200"
                  >
                    Visa alla kategorier
                  </button>
                )}
              </div>

              <CardCarousel label="Kategorier">
                {categories.map((category) => (
                  <CategoryCard
                    key={category}
                    category={category}
                    collectionCount={
                      groups.find((g) => g.key === category)?.collections.length ?? 0
                    }
                    active={effectiveCategory === category}
                    onSelect={() =>
                      setActiveCategory((current) => (current === category ? null : category))
                    }
                  />
                ))}
              </CardCarousel>
            </section>
          )}

          {collections.length === 0 && (
            <p className="rounded-lg border border-dashed border-border-strong/70 bg-surface/50 px-4 py-6 text-center text-sm text-muted-foreground">
              Inga samlingar ännu — skapa en samling med “Ny samling” och lägg dina ljud i den.
            </p>
          )}

          {visibleGroups.map((group) => (
            <section key={group.key} className="flex flex-col gap-3">
              <div className="flex items-baseline gap-3">
                <h2 className="font-display text-lg font-medium tracking-wide text-parchment-100">
                  {group.label}
                </h2>
                <span className="font-mono text-xs text-muted-foreground">
                  {group.collections.length}{" "}
                  {group.collections.length === 1 ? "samling" : "samlingar"}
                </span>
              </div>

              <CardCarousel label={`Samlingar i ${group.label}`}>
                {group.collections.map((collection) => (
                  <CollectionCard
                    key={collection.id}
                    collection={collection}
                    trackCount={fileCountByCollection.get(collection.id) ?? 0}
                  />
                ))}
              </CardCarousel>
            </section>
          ))}

          <AudioFileList
            files={audioFiles}
            collections={collections}
            onChanged={() => void loadAll()}
          />
        </>
      )}
    </div>
  );
}

function CategoryCard({
  category,
  collectionCount,
  active,
  onSelect,
}: {
  category: string;
  collectionCount: number;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={active}
      className={`focus-ring group relative aspect-[16/7] w-[17rem] flex-none snap-start overflow-hidden rounded-xl border text-left transition sm:w-[21rem] ${
        active
          ? "border-ember-400/70 shadow-glow-sm"
          : "border-border hover:border-ember-400/40 hover:shadow-md"
      }`}
    >
      <CollectionArtwork seed={`category:${category}`} active={active} />
      <span className="relative flex h-full flex-col justify-end gap-0.5 p-4">
        <span className="font-display text-lg font-medium tracking-wide text-parchment-50 drop-shadow">
          {category}
        </span>
        <span className="font-mono text-[11px] text-parchment-300/90">
          {collectionCount} {collectionCount === 1 ? "samling" : "samlingar"}
        </span>
      </span>
    </button>
  );
}

function CollectionCard({
  collection,
  trackCount,
}: {
  collection: Collection;
  trackCount: number;
}) {
  return (
    <Link
      href={`/library/${collection.id}`}
      className="focus-ring group relative aspect-video w-[13rem] flex-none snap-start overflow-hidden rounded-xl border border-border transition hover:border-ember-400/40 hover:shadow-md sm:w-[15rem]"
    >
      <CollectionArtwork seed={collection.id} />
      <span className="relative flex h-full flex-col justify-end gap-0.5 p-3">
        <span className="font-display text-sm font-medium tracking-wide text-parchment-50 drop-shadow">
          {collection.name}
        </span>
        <span className="font-mono text-[11px] text-parchment-300/90">
          {trackCount} {trackCount === 1 ? "spår" : "spår"}
        </span>
      </span>
    </Link>
  );
}

function NewCollectionButton({
  categories,
  defaultCategory,
  onCreated,
}: {
  categories: string[];
  defaultCategory: string | null;
  onCreated: () => void;
}) {
  return (
    <Popover
      panelClassName="w-72 max-w-[calc(100vw-2rem)]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className={`focus-ring flex h-9 items-center gap-2 rounded-lg border px-3 text-sm font-medium transition ${
            open
              ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
              : "border-border-strong text-parchment-200 hover:border-ember-400/40 hover:text-ember-300"
          }`}
        >
          <PlusIcon className="h-4 w-4" />
          Ny samling
        </button>
      )}
    >
      {({ close }) => (
        <NewCollectionForm
          categories={categories}
          defaultCategory={defaultCategory}
          onCreated={() => {
            onCreated();
            close();
          }}
        />
      )}
    </Popover>
  );
}

function NewCollectionForm({
  categories,
  defaultCategory,
  onCreated,
}: {
  categories: string[];
  defaultCategory: string | null;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [category, setCategory] = useState(defaultCategory ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmedName = name.trim();
    if (!trimmedName) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/collections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, category: category.trim() || null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Kunde inte skapa samlingen");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kunde inte skapa samlingen");
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          Namn
        </span>
        <input
          type="text"
          autoFocus
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="t.ex. Skogsvandring"
          className="focus-ring rounded-md border border-border-strong bg-background px-2 py-1.5 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
        />
      </label>

      <label className="flex flex-col gap-1">
        <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          Kategori (valfritt)
        </span>
        <input
          type="text"
          value={category}
          list="lyriad-collection-categories"
          onChange={(e) => setCategory(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void submit();
          }}
          placeholder="t.ex. Miljöer"
          className="focus-ring rounded-md border border-border-strong bg-background px-2 py-1.5 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
        />
        <datalist id="lyriad-collection-categories">
          {categories.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>

      {error && <p className="text-xs text-danger-foreground">{error}</p>}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!name.trim() || submitting}
        className="focus-ring rounded-md bg-gradient-to-b from-ember-400 to-ember-500 px-3 py-1.5 text-sm font-medium text-ink-950 shadow-sm transition hover:shadow-glow-sm disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
      >
        {submitting ? "Skapar…" : "Skapa samling"}
      </button>
    </div>
  );
}
