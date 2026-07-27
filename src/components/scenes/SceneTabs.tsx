"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { Scene } from "@/types/domain";

type TabScene = Pick<Scene, "id" | "name" | "favorite">;

type SceneTabsProps = {
  currentSceneId: string;
  currentSceneName: string;
};

/**
 * Favourited scenes as top-level tabs. The current scene is always present
 * even when it isn't favourited, so the active tab never goes missing.
 */
export function SceneTabs({ currentSceneId, currentSceneName }: SceneTabsProps) {
  const [scenes, setScenes] = useState<TabScene[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const res = await fetch("/api/scenes");
      if (!res.ok || cancelled) return;
      const { scenes: rows }: { scenes: TabScene[] } = await res.json();
      if (!cancelled) setScenes(rows.filter((s) => s.favorite));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const favorites = scenes ?? [];
  const tabs = favorites.some((s) => s.id === currentSceneId)
    ? favorites
    : [{ id: currentSceneId, name: currentSceneName, favorite: false }, ...favorites];

  return (
    <nav aria-label="Scener" className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
      {tabs.map((scene) => {
        const active = scene.id === currentSceneId;
        return (
          <Link
            key={scene.id}
            href={`/scenes/${scene.id}`}
            aria-current={active ? "page" : undefined}
            className={`focus-ring flex-none rounded-full px-4 py-1.5 text-sm transition ${
              active
                ? "bg-ink-700 font-medium text-parchment-100"
                : "text-muted-foreground hover:text-parchment-200"
            }`}
          >
            {scene.name}
          </Link>
        );
      })}
      <Link
        href="/scenes"
        className="focus-ring flex-none rounded-full px-3 py-1.5 text-sm text-muted-foreground transition hover:text-parchment-200"
        title="Alla scener"
      >
        Alla scener
      </Link>
    </nav>
  );
}
