"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Tooltip } from "@/components/ui/Tooltip";
import { LibraryIcon, MixerIcon, PlusIcon, ScenesIcon, StarIcon } from "@/components/ui/icons";
import type { Scene } from "@/types/domain";

type SceneListItem = Pick<Scene, "id" | "name" | "favorite">;

const NAV_ITEMS = [
  {
    href: "/",
    label: "Mixer",
    icon: MixerIcon,
    isActive: (path: string) => path === "/" || /^\/scenes\/[^/]+$/.test(path),
  },
  {
    href: "/scenes",
    label: "Scener",
    icon: ScenesIcon,
    isActive: (path: string) => path === "/scenes",
  },
  {
    href: "/library",
    label: "Ljudbibliotek",
    icon: LibraryIcon,
    isActive: (path: string) => path.startsWith("/library"),
  },
];

type QuickAccessPanelProps = {
  open: boolean;
  pathname: string;
  onClose: () => void;
};

/**
 * What the drawer is actually for: getting to a scene. Favourites sit at the
 * top as the shortlist, every scene below them, and a new one can be started
 * without leaving the panel. Reloaded on each open so a scene renamed or
 * favourited elsewhere in the app is already correct when the drawer slides in.
 */
export function QuickAccessPanel({ open, pathname, onClose }: QuickAccessPanelProps) {
  const router = useRouter();
  const [scenes, setScenes] = useState<SceneListItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/scenes").catch(() => null);
      if (!res?.ok || cancelled) return;
      const { scenes: rows }: { scenes: SceneListItem[] } = await res.json();
      if (cancelled) return;
      setScenes(rows);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  // Leaving the create field open would greet the next opening with a stray
  // half-typed name and, on touch, the keyboard. Adjusted during render on the
  // open→closed edge rather than in an effect, so the drawer never renders a
  // frame of the state it is about to throw away.
  const [wasOpen, setWasOpen] = useState(open);
  if (wasOpen !== open) {
    setWasOpen(open);
    if (!open) {
      setCreating(false);
      setNewName("");
      setCreateError(null);
    }
  }

  const favorites = scenes.filter((s) => s.favorite);
  const sorted = [...scenes].sort((a, b) => a.name.localeCompare(b.name, "sv"));

  async function toggleFavorite(id: string, current: boolean) {
    setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, favorite: !current } : s)));
    const res = await fetch(`/api/scenes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ favorite: !current }),
    }).catch(() => null);
    if (!res?.ok) {
      setScenes((prev) => prev.map((s) => (s.id === id ? { ...s, favorite: current } : s)));
    }
  }

  async function createScene() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmed, description: null }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Kunde inte skapa scenen");
      }
      const { scene } = await res.json();
      onClose();
      router.push(`/scenes/${scene.id}`);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : "Kunde inte skapa scenen");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
          Snabbåtkomst
        </p>
        <h2 className="mt-1 font-display text-2xl font-medium tracking-wide text-parchment-100">
          Scener
        </h2>

        {favorites.length > 0 && (
          <section className="mt-6">
            <h3 className="px-1 text-sm text-muted-foreground">Favoriter</h3>
            <ul className="mt-2 flex flex-col">
              {favorites.map((scene) => (
                <SceneRow
                  key={scene.id}
                  scene={scene}
                  active={pathname === `/scenes/${scene.id}`}
                  onNavigate={onClose}
                  onToggleFavorite={() => void toggleFavorite(scene.id, scene.favorite)}
                />
              ))}
            </ul>
          </section>
        )}

        <section className={favorites.length > 0 ? "mt-6 border-t border-border pt-6" : "mt-6"}>
          <h3 className="px-1 text-sm text-muted-foreground">Dina scener</h3>

          {creating ? (
            <div className="mt-2 flex flex-col gap-2 px-1">
              <input
                type="text"
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void createScene();
                  if (e.key === "Escape") {
                    e.stopPropagation();
                    setCreating(false);
                    setNewName("");
                  }
                }}
                placeholder="Namn på scenen"
                className="focus-ring rounded-md border border-border-strong bg-background px-3 py-2 text-sm text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
              />
              {createError && <p className="text-xs text-danger-foreground">{createError}</p>}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => void createScene()}
                  disabled={!newName.trim() || submitting}
                  className="focus-ring rounded-md bg-gradient-to-b from-ember-400 to-ember-500 px-3 py-1.5 text-sm font-medium text-ink-950 shadow-sm transition hover:shadow-glow-sm disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
                >
                  {submitting ? "Skapar…" : "Skapa"}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCreating(false);
                    setNewName("");
                    setCreateError(null);
                  }}
                  disabled={submitting}
                  className="focus-ring rounded-md px-2 py-1.5 text-sm text-parchment-400 transition hover:text-ember-300 disabled:opacity-40"
                >
                  Avbryt
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="focus-ring mt-2 flex w-full items-center gap-2.5 rounded-md px-1 py-2.5 text-left text-sm font-medium text-ember-300 transition hover:text-ember-200"
            >
              <PlusIcon className="h-4 w-4 flex-none" />
              Ny scen
            </button>
          )}

          <ul className="mt-1 flex flex-col">
            {sorted.map((scene) => (
              <SceneRow
                key={scene.id}
                scene={scene}
                active={pathname === `/scenes/${scene.id}`}
                onNavigate={onClose}
                onToggleFavorite={() => void toggleFavorite(scene.id, scene.favorite)}
              />
            ))}
          </ul>

          {loaded && scenes.length === 0 && (
            <p className="mt-2 px-1 text-sm text-muted-foreground">
              Inga scener ännu — skapa din första ovan.
            </p>
          )}
        </section>
      </div>

      <nav aria-label="Sidor" className="mt-4 flex flex-none gap-1 border-t border-border pt-3">
        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              aria-current={active ? "page" : undefined}
              className={`focus-ring flex flex-1 flex-col items-center gap-1.5 rounded-md px-2 py-2.5 text-[11px] font-medium transition ${
                active
                  ? "bg-ember-400/10 text-ember-300"
                  : "text-parchment-400 hover:bg-surface-elevated hover:text-parchment-100"
              }`}
            >
              <Icon className="h-4 w-4 flex-none" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}

function SceneRow({
  scene,
  active,
  onNavigate,
  onToggleFavorite,
}: {
  scene: SceneListItem;
  active: boolean;
  onNavigate: () => void;
  onToggleFavorite: () => void;
}) {
  return (
    <li className="group flex items-center gap-1">
      <Link
        href={`/scenes/${scene.id}`}
        onClick={onNavigate}
        aria-current={active ? "page" : undefined}
        className={`focus-ring min-w-0 flex-1 truncate rounded-md px-1 py-3 text-[15px] transition ${
          active ? "text-ember-300" : "text-parchment-100 hover:text-ember-300"
        }`}
      >
        {scene.name}
      </Link>
      <Tooltip
        label={scene.favorite ? "Ta bort som favorit" : "Gör till favorit"}
        placement="bottom"
        align="end"
        className="flex-none"
      >
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={
            scene.favorite
              ? `Ta bort ${scene.name} som favorit`
              : `Gör ${scene.name} till favorit`
          }
          // Always visible rather than hover-revealed: on the iPad there is no
          // hover, and starring a scene is half of what this panel is for.
          className={`focus-ring flex h-9 w-9 flex-none items-center justify-center rounded-md transition ${
            scene.favorite
              ? "text-ember-400 hover:text-ember-300"
              // /40 landed around 2:1 against the panel — below the 3:1 a
              // non-text control needs to be seen at all.
              : "text-muted-foreground/60 hover:text-ember-300"
          }`}
        >
          <StarIcon className="h-4 w-4" filled={scene.favorite} />
        </button>
      </Tooltip>
    </li>
  );
}
