"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CampaignSwitcher } from "@/components/scenes/CampaignSwitcher";
import { readActiveCampaignId, writeActiveCampaignId } from "@/lib/activeCampaign";
import type { Campaign, Scene } from "@/types/domain";

type TabScene = Pick<Scene, "id" | "name" | "favorite" | "campaignId">;

type SceneTabsProps = {
  currentSceneId: string;
  currentSceneName: string;
  /** Opening a scene switches the desk to its campaign — see below. */
  currentSceneCampaignId: string | null;
};

/**
 * Favourited scenes as top-level tabs, narrowed to one campaign. The current
 * scene is always present even when it isn't favourited, so the active tab
 * never goes missing.
 *
 * Opening a scene that belongs to a campaign makes that campaign the active
 * one: jumping from Barovia to Phandalin over a link or the drawer is itself a
 * statement about which game is being run, and leaving the tabs on the other
 * campaign would strand the scene you just opened among strangers.
 */
export function SceneTabs({
  currentSceneId,
  currentSceneName,
  currentSceneCampaignId,
}: SceneTabsProps) {
  const [scenes, setScenes] = useState<TabScene[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  // Mounted fresh per scene (the page keys SceneClient on the scene id), so
  // this settles the campaign once per visit and manual picks below stick.
  useEffect(() => {
    if (currentSceneCampaignId) writeActiveCampaignId(currentSceneCampaignId);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a cookie on mount, nothing to subscribe to
    setActiveCampaignId(currentSceneCampaignId ?? readActiveCampaignId());
  }, [currentSceneCampaignId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [scenesRes, campaignsRes] = await Promise.all([
        fetch("/api/scenes").catch(() => null),
        fetch("/api/campaigns").catch(() => null),
      ]);
      if (cancelled) return;
      if (scenesRes?.ok) {
        const { scenes: rows }: { scenes: TabScene[] } = await scenesRes.json();
        if (!cancelled) setScenes(rows.filter((s) => s.favorite));
      }
      if (campaignsRes?.ok) {
        const { campaigns: rows }: { campaigns: Campaign[] } = await campaignsRes.json();
        if (!cancelled) setCampaigns(rows);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  function selectCampaign(campaignId: string | null) {
    setActiveCampaignId(campaignId);
    writeActiveCampaignId(campaignId);
  }

  const favorites =
    activeCampaignId === null
      ? scenes
      : scenes.filter((s) => s.campaignId === activeCampaignId);
  const tabs = favorites.some((s) => s.id === currentSceneId)
    ? favorites
    : [
        {
          id: currentSceneId,
          name: currentSceneName,
          favorite: false,
          campaignId: currentSceneCampaignId,
        },
        ...favorites,
      ];

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      <CampaignSwitcher
        campaigns={campaigns}
        activeCampaignId={activeCampaignId}
        onSelect={selectCampaign}
      />
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
        >
          Alla scener
        </Link>
      </nav>
    </div>
  );
}
