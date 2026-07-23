"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StarIcon } from "@/components/ui/icons";
import type { Scene } from "@/types/domain";

type FavoriteScene = Pick<Scene, "id" | "name" | "favorite">;

type FavoriteScenesBarProps = {
  /** Hide this scene's own button when viewing it. */
  currentSceneId?: string;
};

export function FavoriteScenesBar({ currentSceneId }: FavoriteScenesBarProps) {
  const [scenes, setScenes] = useState<FavoriteScene[]>([]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/scenes");
      if (!res.ok || cancelled) return;
      const { scenes: rows }: { scenes: FavoriteScene[] } = await res.json();
      setScenes(rows.filter((s) => s.favorite));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = scenes.filter((s) => s.id !== currentSceneId);
  if (visible.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex-none font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
        Favoriter
      </span>
      {visible.map((scene) => (
        <Link
          key={scene.id}
          href={`/scenes/${scene.id}`}
          className="focus-ring inline-flex items-center gap-1.5 rounded-full border border-ember-400/40 bg-ember-400/10 px-3 py-1 text-xs font-medium text-ember-300 transition hover:bg-ember-400/20"
        >
          <StarIcon className="h-3 w-3" filled />
          {scene.name}
        </Link>
      ))}
    </div>
  );
}
