"use client";

import { useId, useState } from "react";
import { Popover } from "@/components/ui/Popover";
import { Tooltip } from "@/components/ui/Tooltip";
import { RenameMenuItem } from "@/components/ui/RenameMenuItem";
import { MixerIcon, ResetIcon, TrashIcon } from "@/components/ui/icons";
import type { FadeCurve } from "@/audio-engine";
import type { Campaign, MixPreset } from "@/types/domain";

type CrossfadeOption = { slotIndex: number; label: string };

type MixerMenuProps = {
  fadeDurationsMs: number[];
  /** Ticked length, or null when master play/pause should be instant. */
  fadeDurationMs: number | null;
  onFadeDurationChange: (durationMs: number | null) => void;

  presets: MixPreset[];
  onApplyPreset: (preset: MixPreset) => void;
  onDeletePreset: (presetId: string) => void;
  deletingPresetId: string | null;
  /** Resolves to an error message, or null when the save succeeded. */
  onSavePreset: (name: string) => Promise<string | null>;

  crossfadeOptions: CrossfadeOption[];
  onCrossfade: (from: number, to: number, durationMs: number, curve: FadeCurve) => void;

  sceneName: string;
  onRenameScene: (name: string) => void;
  /** The campaign this scene is filed under — which tabs it appears among. */
  campaigns: Campaign[];
  sceneCampaignId: string | null;
  onSceneCampaignChange: (campaignId: string | null) => void;
  /** Stops everything playing and returns every fader to its default. */
  onResetAudio: () => void;
  onDeleteScene: () => void;
  deletingScene: boolean;
};

const FIELD_CLASS =
  "focus-ring rounded-md border border-border-strong bg-background px-2 py-1 text-xs text-parchment-100 focus:border-ember-400";

const MENU_ITEM_CLASS =
  "focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-parchment-200 transition hover:bg-ink-700";

/**
 * Everything that shapes the mix but doesn't belong on the surface: fades,
 * saved quick mixes and crossfade. Lives behind the mixer button so the board
 * itself stays down to faders and slots.
 */
export function MixerMenu({
  fadeDurationsMs,
  fadeDurationMs,
  onFadeDurationChange,
  presets,
  onApplyPreset,
  onDeletePreset,
  deletingPresetId,
  onSavePreset,
  crossfadeOptions,
  onCrossfade,
  sceneName,
  onRenameScene,
  campaigns,
  sceneCampaignId,
  onSceneCampaignChange,
  onResetAudio,
  onDeleteScene,
  deletingScene,
}: MixerMenuProps) {
  // Deleting a scene takes its slots and mixes with it and there is no undo, so
  // the row asks once before it does anything. Kept inside the panel, which
  // unmounts on close — walking away is enough to change your mind.
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  // Groups the radios below, so arrow keys move between them and not into some
  // other radio group that happens to be on the page.
  const fadeGroupName = useId();

  const [presetName, setPresetName] = useState("");
  const [presetSubmitting, setPresetSubmitting] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);

  const [crossfadeFrom, setCrossfadeFrom] = useState<number | null>(null);
  const [crossfadeTo, setCrossfadeTo] = useState<number | null>(null);
  const [crossfadeMs, setCrossfadeMs] = useState(3000);
  const [crossfadeCurve, setCrossfadeCurve] = useState<FadeCurve>("linear");

  // Fall back to the first two available slots until the user picks explicitly,
  // so the controls are usable the moment two tracks are loaded.
  const from = crossfadeFrom ?? crossfadeOptions[0]?.slotIndex ?? null;
  const to = crossfadeTo ?? crossfadeOptions[1]?.slotIndex ?? null;
  const canCrossfade = from !== null && to !== null && from !== to;

  async function submitPreset() {
    const trimmed = presetName.trim();
    if (!trimmed) return;
    setPresetSubmitting(true);
    setPresetError(null);
    const error = await onSavePreset(trimmed);
    setPresetSubmitting(false);
    if (error) {
      setPresetError(error);
      return;
    }
    setPresetName("");
  }

  return (
    <Popover
      panelClassName="w-80 max-w-[calc(100vw-2rem)]"
      trigger={({ open, toggle }) => (
        <Tooltip label="Mixerinställningar" align="end">
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-label="Mixerinställningar"
            className={`focus-ring flex h-9 w-9 items-center justify-center rounded-lg border transition ${
              open
                ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                : "border-border-strong text-muted-foreground hover:border-ember-400/40 hover:text-ember-300"
            }`}
          >
            <MixerIcon className="h-4 w-4" />
          </button>
        </Tooltip>
      )}
    >
      {({ close }) => (
        <div className="flex flex-col gap-4">
          <section>
            <h3 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              Fade
            </h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Vald längd gäller både in och ut, för ett enskilt spår som för hela mixen. 0s
              växlar direkt.
            </p>
            {/* A segmented control rather than tickboxes: the choice is one-of-N,
                and "no fade" reads better as its own 0s option than as the state
                you land in by unticking everything. Radios, not buttons, so arrow
                keys and screen readers get the group for free. */}
            <div className="mt-2 flex items-center gap-1">
              {[null, ...fadeDurationsMs].map((ms) => {
                const selected = fadeDurationMs === ms;
                return (
                  <label
                    key={ms ?? 0}
                    className={`focus-ring cursor-pointer rounded-md px-3 py-1.5 text-xs font-medium transition has-[:focus-visible]:shadow-glow-sm ${
                      selected
                        ? "bg-ember-400/15 text-ember-300"
                        : "text-parchment-300 hover:bg-ink-700 hover:text-parchment-100"
                    }`}
                  >
                    <input
                      type="radio"
                      name={fadeGroupName}
                      checked={selected}
                      onChange={() => onFadeDurationChange(ms)}
                      className="sr-only"
                    />
                    {(ms ?? 0) / 1000}s
                  </label>
                );
              })}
            </div>
          </section>

          <section className="border-t border-border pt-3">
            <h3 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
              Snabbmix
            </h3>
            {presets.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1">
                {presets.map((preset) => (
                  <li key={preset.id} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onApplyPreset(preset)}
                      title={`Applicera "${preset.name}"`}
                      className="focus-ring flex-1 truncate rounded-md px-2 py-1 text-left text-xs text-parchment-200 transition hover:bg-ink-700 hover:text-ember-300"
                    >
                      {preset.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeletePreset(preset.id)}
                      disabled={deletingPresetId === preset.id}
                      aria-label={`Ta bort snabbmix ${preset.name}`}
                      className="focus-ring flex h-6 w-6 flex-none items-center justify-center rounded-full text-muted-foreground/80 transition hover:text-danger-foreground disabled:opacity-40"
                    >
                      ×
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2 flex items-center gap-1.5">
              <input
                type="text"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submitPreset();
                }}
                placeholder="Spara nuvarande mix som…"
                aria-label="Namn på snabbmix"
                className={`${FIELD_CLASS} min-w-0 flex-1 placeholder:text-muted-foreground`}
              />
              <button
                type="button"
                onClick={() => void submitPreset()}
                disabled={!presetName.trim() || presetSubmitting}
                className="focus-ring flex-none rounded-md border border-border-strong px-2 py-1 text-xs font-medium text-ember-400 transition enabled:hover:border-ember-400/60 enabled:hover:text-ember-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {presetSubmitting ? "Sparar…" : "Spara"}
              </button>
            </div>
            {presetError && <p className="mt-1 text-[11px] text-danger-foreground">{presetError}</p>}
          </section>

          {crossfadeOptions.length >= 2 && (
            <section className="border-t border-border pt-3">
              <h3 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                Crossfade
              </h3>
              <div className="mt-2 flex flex-col gap-2">
                <div className="flex items-center gap-1.5">
                  <select
                    value={from ?? ""}
                    onChange={(e) => setCrossfadeFrom(Number(e.target.value))}
                    aria-label="Crossfade från"
                    className={`${FIELD_CLASS} min-w-0 flex-1`}
                  >
                    {crossfadeOptions.map((option) => (
                      <option key={option.slotIndex} value={option.slotIndex}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <span className="flex-none text-muted-foreground">→</span>
                  <select
                    value={to ?? ""}
                    onChange={(e) => setCrossfadeTo(Number(e.target.value))}
                    aria-label="Crossfade till"
                    className={`${FIELD_CLASS} min-w-0 flex-1`}
                  >
                    {crossfadeOptions.map((option) => (
                      <option key={option.slotIndex} value={option.slotIndex}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-1.5">
                  <label className="flex flex-1 items-center gap-1 text-[11px] text-muted-foreground">
                    Tid
                    <input
                      type="number"
                      min={0}
                      step={100}
                      value={crossfadeMs}
                      onChange={(e) => setCrossfadeMs(Number(e.target.value))}
                      className={`${FIELD_CLASS} w-full min-w-0`}
                    />
                    ms
                  </label>
                  <select
                    value={crossfadeCurve}
                    onChange={(e) => setCrossfadeCurve(e.target.value as FadeCurve)}
                    aria-label="Kurva"
                    className={FIELD_CLASS}
                  >
                    <option value="linear">Linjär</option>
                    <option value="exponential">Exponentiell</option>
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (canCrossfade) onCrossfade(from, to, crossfadeMs, crossfadeCurve);
                  }}
                  disabled={!canCrossfade}
                  className="focus-ring rounded-md bg-gradient-to-b from-ember-400 to-ember-500 px-3 py-1.5 text-xs font-medium text-ink-950 shadow-sm transition hover:shadow-glow-sm disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Crossfade
                </button>
              </div>
            </section>
          )}

          <section className="flex flex-col gap-0.5 border-t border-border pt-3">
            <RenameMenuItem
              value={sceneName}
              // A scene must always have a name, so "cleared" and "unchanged" both
              // arrive here as null and both mean: leave the current name alone.
              fallback={sceneName}
              onCommit={(name) => {
                if (name) onRenameScene(name);
              }}
              onDone={close}
              itemClassName={MENU_ITEM_CLASS}
              label="Byt namn på scenen"
            />

            {campaigns.length > 0 && (
              <label className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs text-parchment-200">
                Kampanj
                <select
                  value={sceneCampaignId ?? ""}
                  onChange={(e) => onSceneCampaignChange(e.target.value || null)}
                  className={FIELD_CLASS}
                >
                  <option value="">Utan kampanj</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.name}
                    </option>
                  ))}
                </select>
              </label>
            )}

            <button type="button" onClick={onResetAudio} className={MENU_ITEM_CLASS}>
              <ResetIcon className="h-3.5 w-3.5 flex-none" />
              Återställ ljud
            </button>

            <button
              type="button"
              onClick={() => (confirmingDelete ? onDeleteScene() : setConfirmingDelete(true))}
              disabled={deletingScene}
              className={`${MENU_ITEM_CLASS} text-wine-400 hover:text-wine-300 disabled:opacity-40`}
            >
              <TrashIcon className="h-3.5 w-3.5 flex-none" />
              {deletingScene
                ? "Tar bort…"
                : confirmingDelete
                  ? "Säker? Klicka igen"
                  : "Ta bort scen"}
            </button>
          </section>
        </div>
      )}
    </Popover>
  );
}
