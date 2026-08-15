"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { CampaignSwitcher } from "@/components/scenes/CampaignSwitcher";
import { StarIcon } from "@/components/ui/icons";
import { readActiveCampaignId, writeActiveCampaignId } from "@/lib/activeCampaign";
import type { Campaign, Scene } from "@/types/domain";

type FavoriteScene = Pick<Scene, "id" | "name" | "favorite" | "campaignId">;

type FavoriteScenesBarProps = {
  /** Hide this scene's own button when viewing it. */
  currentSceneId?: string;
};

export function FavoriteScenesBar({ currentSceneId }: FavoriteScenesBarProps) {
  const [scenes, setScenes] = useState<FavoriteScene[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reading a cookie on mount, nothing to subscribe to
    setActiveCampaignId(readActiveCampaignId());
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const [scenesRes, campaignsRes] = await Promise.all([
        fetch("/api/scenes").catch(() => null),
        fetch("/api/campaigns").catch(() => null),
      ]);
      if (cancelled) return;
      if (scenesRes?.ok) {
        const { scenes: rows }: { scenes: FavoriteScene[] } = await scenesRes.json();
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

  const visible = scenes.filter(
    (s) =>
      s.id !== currentSceneId &&
      (activeCampaignId === null || s.campaignId === activeCampaignId)
  );
  if (visible.length === 0 && campaigns.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="flex-none font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
        Favoriter
      </span>
      <CampaignSwitcher
        campaigns={campaigns}
        activeCampaignId={activeCampaignId}
        onSelect={selectCampaign}
      />
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
      {visible.length === 0 && (
        <span className="text-xs text-muted-foreground">
          Inga favoriter i den här kampanjen än.
        </span>
      )}
    </div>
  );
}
