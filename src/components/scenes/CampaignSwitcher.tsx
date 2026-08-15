"use client";

import Link from "next/link";
import { Popover } from "@/components/ui/Popover";
import { ChevronDownIcon } from "@/components/ui/icons";
import type { Campaign } from "@/types/domain";

export const ALL_CAMPAIGNS_LABEL = "Alla kampanjer";

type CampaignSwitcherProps = {
  campaigns: Campaign[];
  /** Null means every campaign's favourites are shown at once. */
  activeCampaignId: string | null;
  onSelect: (campaignId: string | null) => void;
  className?: string;
};

/**
 * Picks which campaign the favourites belong to. Sits to the left of the scene
 * tabs, because it decides what those tabs contain: an evening of Curse of
 * Strahd has no use for the Phandelver shortlist.
 *
 * Hidden entirely until a campaign exists — a switcher with one option is just
 * a label, and the scenes page is where campaigns get made.
 */
export function CampaignSwitcher({
  campaigns,
  activeCampaignId,
  onSelect,
  className,
}: CampaignSwitcherProps) {
  if (campaigns.length === 0) return null;

  const active = campaigns.find((c) => c.id === activeCampaignId) ?? null;

  return (
    <Popover
      align="left"
      className={`flex-none ${className ?? ""}`}
      panelClassName="w-60 max-w-[calc(100vw-2rem)]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label={`Kampanj: ${active?.name ?? ALL_CAMPAIGNS_LABEL}`}
          className={`focus-ring flex max-w-[12rem] items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition ${
            open
              ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
              : "border-border-strong text-parchment-200 hover:border-ember-400/40 hover:text-ember-300"
          }`}
        >
          <span className="truncate">{active?.name ?? ALL_CAMPAIGNS_LABEL}</span>
          <ChevronDownIcon className="h-4 w-4 flex-none" />
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col">
          <p className="px-2 pb-1 font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            Kampanj
          </p>
          <CampaignOption
            label={ALL_CAMPAIGNS_LABEL}
            active={activeCampaignId === null}
            onSelect={() => {
              onSelect(null);
              close();
            }}
          />
          {campaigns.map((campaign) => (
            <CampaignOption
              key={campaign.id}
              label={campaign.name}
              active={campaign.id === activeCampaignId}
              onSelect={() => {
                onSelect(campaign.id);
                close();
              }}
            />
          ))}
          <Link
            href="/scenes"
            onClick={close}
            className="focus-ring mt-1 rounded-md border-t border-border px-2 pt-2 pb-1 text-xs text-muted-foreground transition hover:text-ember-300"
          >
            Hantera kampanjer
          </Link>
        </div>
      )}
    </Popover>
  );
}

function CampaignOption({
  label,
  active,
  onSelect,
}: {
  label: string;
  active: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`focus-ring truncate rounded-md px-2 py-2 text-left text-sm transition ${
        active
          ? "bg-ember-400/10 font-medium text-ember-300"
          : "text-parchment-100 hover:bg-surface hover:text-ember-300"
      }`}
    >
      {label}
    </button>
  );
}
