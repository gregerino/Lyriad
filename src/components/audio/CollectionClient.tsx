"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { CollectionArtwork } from "@/components/audio/CollectionArtwork";
import { Popover } from "@/components/ui/Popover";
import { RenameMenuItem } from "@/components/ui/RenameMenuItem";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  ChevronDownIcon,
  KebabIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  TrashIcon,
  XIcon,
} from "@/components/ui/icons";
import { AUDIO_CATEGORY_LABELS, formatBytes } from "@/lib/audio/limits";
import type { AudioFileWithMeta, Collection } from "@/types/domain";

const MENU_ITEM_CLASS =
  "focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-parchment-200 transition hover:bg-ink-700";

type CollectionClientProps = { collectionId: string };

export function CollectionClient({ collectionId }: CollectionClientProps) {
  const router = useRouter();

  const [collection, setCollection] = useState<Collection | null>(null);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [audioFiles, setAudioFiles] = useState<AudioFileWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // One shared element for the whole grid: previewing is a "what is this file"
  // check, so a second track always replaces the first rather than layering.
  const previewRef = useRef<HTMLAudioElement | null>(null);
  const [previewingId, setPreviewingId] = useState<string | null>(null);

  async function loadAll() {
    setLoadError(null);
    try {
      const [collectionRes, collectionsRes, filesRes] = await Promise.all([
        fetch(`/api/collections/${collectionId}`),
        fetch("/api/collections"),
        fetch("/api/audio-files"),
      ]);
      if (collectionRes.status === 404) {
        setNotFound(true);
        return;
      }
      if (!collectionRes.ok || !collectionsRes.ok || !filesRes.ok) {
        throw new Error("Kunde inte ladda samlingen");
      }
      const { collection: row } = await collectionRes.json();
      const { collections: cols } = await collectionsRes.json();
      const { audioFiles: files } = await filesRes.json();
      setCollection(row);
      setCollections(cols);
      setAudioFiles(files);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Kunde inte ladda samlingen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount, no external subscription to hang this off
    void loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadAll only depends on collectionId, which is stable for the component's lifetime (page.tsx keys on it)
  }, [collectionId]);

  useEffect(() => {
    return () => {
      previewRef.current?.pause();
      previewRef.current = null;
    };
  }, []);

  const tracks = useMemo(
    () => audioFiles.filter((file) => file.collectionIds.includes(collectionId)),
    [audioFiles, collectionId]
  );
  const outsideTracks = useMemo(
    () => audioFiles.filter((file) => !file.collectionIds.includes(collectionId)),
    [audioFiles, collectionId]
  );
  const categories = useMemo(() => {
    const names = new Set<string>();
    for (const c of collections) if (c.category) names.add(c.category);
    return Array.from(names).sort((a, b) => a.localeCompare(b, "sv"));
  }, [collections]);

  function togglePreview(file: AudioFileWithMeta) {
    // Whatever was playing stops first, so the grid never layers two previews —
    // a fresh element per preview rather than a reused one, since a swapped
    // `src` on a playing element is the fiddlier of the two.
    previewRef.current?.pause();
    previewRef.current = null;

    if (previewingId === file.id) {
      setPreviewingId(null);
      return;
    }

    const element = new Audio(file.playbackUrl);
    element.addEventListener("ended", () => setPreviewingId(null));
    previewRef.current = element;
    void element
      .play()
      .then(() => setPreviewingId(file.id))
      .catch(() => setPreviewingId(null));
  }

  async function patchCollection(patch: { name?: string; category?: string | null }) {
    const res = await fetch(`/api/collections/${collectionId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) return;
    const { collection: row } = await res.json();
    setCollection(row);
  }

  async function setMembers(changes: { add?: string[]; remove?: string[] }) {
    const res = await fetch(`/api/collections/${collectionId}/members`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    if (!res.ok) return;
    await loadAll();
  }

  async function deleteCollection() {
    setDeleting(true);
    const res = await fetch(`/api/collections/${collectionId}`, { method: "DELETE" }).catch(
      () => null
    );
    if (!res?.ok) {
      setDeleting(false);
      return;
    }
    router.push("/library");
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Laddar samling…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Samlingen hittades inte.</p>
        <Link
          href="/library"
          className="focus-ring rounded-sm text-sm text-ember-400 hover:text-ember-300"
        >
          Tillbaka till biblioteket
        </Link>
      </div>
    );
  }

  if (loadError || !collection) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-danger-foreground">{loadError ?? "Kunde inte ladda samlingen"}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void loadAll();
          }}
          className="focus-ring rounded-sm text-sm text-ember-400 hover:text-ember-300"
        >
          Försök igen
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <Link
        href="/library"
        className="focus-ring flex w-fit items-center gap-1.5 rounded-md text-xs text-muted-foreground transition hover:text-ember-300"
      >
        <ChevronDownIcon className="h-4 w-4 rotate-90" />
        Ljudbibliotek
      </Link>

      {/* Stacked until there is room for the artwork, the title and the
          actions side by side — the title is one long word often enough that
          squeezing it into a leftover column pushes it off the page. */}
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end">
        <div className="relative aspect-video w-full max-w-[20rem] flex-none overflow-hidden rounded-xl border border-border shadow-md">
          <CollectionArtwork seed={collection.id} active />
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-2">
          {collection.category && (
            <span className="w-fit rounded-full border border-border-strong px-2.5 py-0.5 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              {collection.category}
            </span>
          )}
          <h1 className="font-display text-3xl font-medium tracking-wide break-words text-parchment-100 sm:text-4xl">
            {collection.name}
          </h1>
          <p className="font-mono text-xs text-muted-foreground">
            {tracks.length} {tracks.length === 1 ? "spår" : "spår"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:flex-none">
          <AddTracksButton files={outsideTracks} onAdd={(ids) => void setMembers({ add: ids })} />

          <Popover
            panelClassName="w-60 max-w-[calc(100vw-2rem)]"
            trigger={({ open, toggle }) => (
              <Tooltip label="Samlingens inställningar" align="end">
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={open}
                  aria-label="Samlingens inställningar"
                  className={`focus-ring flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                    open
                      ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                      : "border-border-strong text-muted-foreground hover:border-ember-400/40 hover:text-ember-300"
                  }`}
                >
                  <KebabIcon className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
          >
            {({ close }) => (
              <CollectionMenu
                collection={collection}
                categories={categories}
                deleting={deleting}
                onRename={(name) => {
                  if (name) void patchCollection({ name });
                }}
                onCategory={(category) => void patchCollection({ category })}
                onDelete={() => void deleteCollection()}
                onDone={close}
              />
            )}
          </Popover>
        </div>
      </div>

      {tracks.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border-strong/70 bg-surface/50 px-4 py-8 text-center text-sm text-muted-foreground">
          Inga spår i samlingen ännu — lägg till ljud med “Lägg till ljud”.
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {tracks.map((file) => (
            <div
              key={file.id}
              className="group relative flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-xs transition hover:border-ember-400/40"
            >
              <button
                type="button"
                onClick={() => togglePreview(file)}
                aria-label={
                  previewingId === file.id
                    ? `Stoppa förhandsvisning av ${file.filename}`
                    : `Förhandslyssna på ${file.filename}`
                }
                className={`focus-ring flex h-8 w-8 flex-none items-center justify-center rounded-full border transition ${
                  previewingId === file.id
                    ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                    : "border-border-strong text-muted-foreground hover:border-ember-400/40 hover:text-ember-300"
                }`}
              >
                {previewingId === file.id ? (
                  <PauseIcon className="h-3.5 w-3.5" />
                ) : (
                  <PlayIcon className="h-3.5 w-3.5 translate-x-px" />
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-parchment-100">{file.filename}</p>
                <p className="font-mono text-[11px] text-muted-foreground">
                  {file.category ? `${AUDIO_CATEGORY_LABELS[file.category]} · ` : ""}
                  {formatBytes(file.sizeBytes)}
                </p>
              </div>

              <Tooltip label="Ta bort från samlingen" align="end" className="flex-none">
                <button
                  type="button"
                  onClick={() => void setMembers({ remove: [file.id] })}
                  aria-label={`Ta bort ${file.filename} från ${collection.name}`}
                  className="hover-reveal focus-ring flex-none rounded-full text-muted-foreground/80 transition hover:text-wine-400"
                >
                  <XIcon className="h-4 w-4" />
                </button>
              </Tooltip>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CollectionMenu({
  collection,
  categories,
  deleting,
  onRename,
  onCategory,
  onDelete,
  onDone,
}: {
  collection: Collection;
  categories: string[];
  deleting: boolean;
  onRename: (name: string | null) => void;
  onCategory: (category: string | null) => void;
  onDelete: () => void;
  onDone: () => void;
}) {
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [editingCategory, setEditingCategory] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState(collection.category ?? "");

  function commitCategory() {
    const trimmed = categoryDraft.trim();
    if (trimmed === (collection.category ?? "")) return;
    onCategory(trimmed === "" ? null : trimmed);
  }

  return (
    <div className="flex flex-col gap-1">
      <RenameMenuItem
        value={collection.name}
        fallback={collection.name}
        onCommit={onRename}
        onDone={onDone}
        itemClassName={MENU_ITEM_CLASS}
        label="Byt namn"
      />

      {editingCategory ? (
        <label className="flex flex-col gap-1 px-1 py-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            Kategori
          </span>
          <input
            type="text"
            autoFocus
            value={categoryDraft}
            list="lyriad-collection-categories-menu"
            onChange={(e) => setCategoryDraft(e.target.value)}
            onBlur={commitCategory}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitCategory();
                onDone();
              }
            }}
            placeholder="Utan kategori"
            className="focus-ring w-full rounded-md border border-border-strong bg-background px-2 py-1 text-xs text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
          />
          <datalist id="lyriad-collection-categories-menu">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </label>
      ) : (
        <button
          type="button"
          onClick={() => setEditingCategory(true)}
          className={MENU_ITEM_CLASS}
        >
          <PlusIcon className="h-3.5 w-3.5 flex-none" />
          {collection.category ? "Byt kategori" : "Sätt kategori"}
        </button>
      )}

      <button
        type="button"
        onClick={() => (confirmingDelete ? onDelete() : setConfirmingDelete(true))}
        disabled={deleting}
        className={`${MENU_ITEM_CLASS} text-wine-400 hover:text-wine-300 disabled:opacity-40`}
      >
        <TrashIcon className="h-3.5 w-3.5 flex-none" />
        {deleting ? "Tar bort…" : confirmingDelete ? "Säker? Klicka igen" : "Ta bort samling"}
      </button>
    </div>
  );
}

function AddTracksButton({
  files,
  onAdd,
}: {
  files: AudioFileWithMeta[];
  onAdd: (audioFileIds: string[]) => void;
}) {
  return (
    <Popover
      panelClassName="w-80 max-w-[calc(100vw-2rem)]"
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
          Lägg till ljud
        </button>
      )}
    >
      {({ close }) => (
        <AddTracksPanel
          files={files}
          onAdd={(ids) => {
            onAdd(ids);
            close();
          }}
        />
      )}
    </Popover>
  );
}

function AddTracksPanel({
  files,
  onAdd,
}: {
  files: AudioFileWithMeta[];
  onAdd: (audioFileIds: string[]) => void;
}) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return q ? files.filter((f) => f.filename.toLowerCase().includes(q)) : files;
  }, [files, search]);

  if (files.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Alla ljud i biblioteket ligger redan i den här samlingen.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        type="text"
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Sök på filnamn…"
        className="focus-ring rounded-md border border-border-strong bg-background px-2 py-1.5 text-xs text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
      />

      <div className="flex max-h-64 flex-col gap-0.5 overflow-y-auto">
        {filtered.map((file) => (
          <label
            key={file.id}
            className="flex cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 text-xs text-parchment-200 transition hover:bg-ink-700"
          >
            <input
              type="checkbox"
              checked={selected.has(file.id)}
              onChange={() =>
                setSelected((prev) => {
                  const next = new Set(prev);
                  if (next.has(file.id)) next.delete(file.id);
                  else next.add(file.id);
                  return next;
                })
              }
              className="focus-ring lyriad-checkbox h-3.5 w-3.5 flex-none"
            />
            <span className="truncate">{file.filename}</span>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className="px-1.5 py-1 text-xs text-muted-foreground">Inga filer matchar sökningen.</p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onAdd(Array.from(selected))}
        disabled={selected.size === 0}
        className="focus-ring rounded-md bg-gradient-to-b from-ember-400 to-ember-500 px-3 py-1.5 text-xs font-medium text-ink-950 shadow-sm transition hover:shadow-glow-sm disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
      >
        {selected.size === 0
          ? "Välj ljud att lägga till"
          : `Lägg till ${selected.size} ${selected.size === 1 ? "ljud" : "ljud"}`}
      </button>
    </div>
  );
}
