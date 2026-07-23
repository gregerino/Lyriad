"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/Slider";
import { LoopIcon, SpeakerOffIcon, SpeakerOnIcon, XIcon } from "@/components/ui/icons";
import { formatDuration } from "@/lib/audio/limits";
import type { TrackState } from "@/audio-engine";
import type { AudioFileWithMeta, FadeSettings, MusicSlot } from "@/types/domain";
import { AudioFileSelect } from "./AudioFileSelect";
import type { SlotLoadState } from "./types";

type MusicSlotRowProps = {
  slot: MusicSlot;
  file: AudioFileWithMeta | null;
  libraryFiles: AudioFileWithMeta[];
  track: TrackState | undefined;
  loadState: SlotLoadState;
  assigning: boolean;
  assignError: string | null;
  onAssign: (audioFileId: string) => void;
  onClear: () => void;
  onRetry: () => void;
  onFadeIn: () => void;
  onFadeOut: () => void;
  onStop: () => void;
  onVolumeChange: (volume: number) => void;
  onLoopChange: (loop: boolean) => void;
  onMuteChange: (muted: boolean) => void;
  onFadeSettingsChange: (fade: FadeSettings) => void;
  onRename: (name: string | null) => void;
};

export function MusicSlotRow({
  slot,
  file,
  libraryFiles,
  track,
  loadState,
  assigning,
  assignError,
  onAssign,
  onClear,
  onRetry,
  onFadeIn,
  onFadeOut,
  onStop,
  onVolumeChange,
  onLoopChange,
  onMuteChange,
  onFadeSettingsChange,
  onRename,
}: MusicSlotRowProps) {
  const ready = Boolean(slot.audioFileId) && loadState.status === "loaded" && Boolean(track);
  const resolvedName = slot.name ?? file?.filename ?? "Okänd fil";
  const [nameDraft, setNameDraft] = useState(resolvedName);
  // Resets the draft whenever the resolved name changes externally (reassignment,
  // refetch) — the sanctioned "adjust state during render" pattern, not an effect,
  // so typing in progress is never clobbered by an unrelated re-render.
  const [syncedName, setSyncedName] = useState(resolvedName);
  if (resolvedName !== syncedName) {
    setSyncedName(resolvedName);
    setNameDraft(resolvedName);
  }

  function commitName() {
    const trimmed = nameDraft.trim();
    const next = trimmed === "" ? null : trimmed;
    if (next !== slot.name) onRename(next);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface p-3 shadow-xs transition hover:border-border-strong">
      <div className="flex items-center justify-between gap-1">
        <span className="font-mono text-xs text-muted-foreground">
          {String(slot.slotIndex).padStart(2, "0")}
        </span>
        {slot.audioFileId && (
          <button
            type="button"
            onClick={onClear}
            disabled={assigning}
            aria-label="Rensa plats"
            title="Rensa plats"
            className="focus-ring flex h-6 w-6 flex-none items-center justify-center rounded-full text-muted-foreground/80 transition hover:bg-ink-700 hover:text-wine-400 disabled:opacity-30"
          >
            <XIcon className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {slot.audioFileId ? (
        <div className="flex items-start justify-between gap-2">
          <input
            type="text"
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                commitName();
                (e.target as HTMLInputElement).blur();
              }
              if (e.key === "Escape") {
                setNameDraft(resolvedName);
                (e.target as HTMLInputElement).blur();
              }
            }}
            title={file?.filename}
            aria-label="Namn på musikplats"
            className="focus-ring min-w-0 flex-1 truncate rounded bg-transparent text-sm font-medium text-parchment-100 focus:bg-background"
          />
          {track && (
            <span className="flex-none font-mono text-[11px] text-muted-foreground">
              {formatDuration(track.duration)}
            </span>
          )}
        </div>
      ) : (
        <>
          <AudioFileSelect
            files={libraryFiles}
            disabled={assigning}
            onSelect={onAssign}
            placeholder="Tilldela fil…"
            className="focus-ring w-full rounded-md border border-border-strong bg-background px-2 py-1.5 text-xs text-parchment-100 focus:border-ember-400 disabled:opacity-40"
          />
          {libraryFiles.length === 0 && (
            <p className="text-[11px] text-muted-foreground">
              Inga ljudfiler ännu — ladda upp i biblioteket.
            </p>
          )}
        </>
      )}
      {assigning && <span className="text-xs text-muted-foreground">Tilldelar…</span>}
      {assignError && <p className="text-xs text-danger-foreground">{assignError}</p>}
      {loadState.status === "loading" && (
        <p className="text-xs text-muted-foreground">Laddar ljud…</p>
      )}
      {loadState.status === "error" && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="text-xs text-danger-foreground">{loadState.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="focus-ring rounded-sm text-xs text-ember-400 hover:text-ember-300"
          >
            Försök igen
          </button>
        </div>
      )}

      {slot.audioFileId && (
        <div className="flex items-center gap-2">
          <SpeakerOnIcon className="h-3.5 w-3.5 flex-none text-muted-foreground" />
          <Slider
            value={track ? track.volume : slot.volume}
            onChange={onVolumeChange}
            className="w-full"
            aria-label="Volym"
          />
          <span className="w-9 flex-none text-right font-mono text-xs text-muted-foreground">
            {Math.round((track ? track.volume : slot.volume) * 100)}%
          </span>
        </div>
      )}

      {ready && track && (
        <>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onLoopChange(!track.loop)}
              aria-pressed={track.loop}
              aria-label={track.loop ? "Loop på" : "Loop av"}
              title="Loop"
              className={`focus-ring flex h-8 w-8 flex-none items-center justify-center rounded-md border transition ${
                track.loop
                  ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                  : "border-border-strong text-muted-foreground hover:border-ember-400/40 hover:text-ember-300"
              }`}
            >
              <LoopIcon className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={() => onMuteChange(!track.muted)}
              aria-pressed={track.muted}
              aria-label={track.muted ? "Avmuta" : "Muta"}
              title={track.muted ? "Avmuta" : "Muta"}
              className={`focus-ring flex h-8 w-8 flex-none items-center justify-center rounded-md border transition ${
                track.muted
                  ? "border-wine-500/60 bg-wine-500/10 text-wine-400"
                  : "border-border-strong text-muted-foreground hover:border-ember-400/40 hover:text-ember-300"
              }`}
            >
              {track.muted ? (
                <SpeakerOffIcon className="h-4 w-4" />
              ) : (
                <SpeakerOnIcon className="h-4 w-4" />
              )}
            </button>

            {track.fading && <span className="text-xs text-ember-400">fadar…</span>}
          </div>

          <div className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={onFadeIn}
              disabled={track.isPlaying}
              className="focus-ring rounded-md border border-border-strong px-2 py-1 transition enabled:hover:border-ember-400/60 enabled:hover:text-ember-300 disabled:opacity-30"
            >
              In
            </button>
            <button
              type="button"
              onClick={onFadeOut}
              disabled={!track.isPlaying}
              className="focus-ring rounded-md border border-border-strong px-2 py-1 transition enabled:hover:border-ember-400/60 enabled:hover:text-ember-300 disabled:opacity-30"
            >
              Ut
            </button>
            <button
              type="button"
              onClick={onStop}
              className="focus-ring rounded-md border border-border-strong px-2 py-1 transition hover:border-ember-400/60 hover:text-ember-300"
            >
              Stopp
            </button>
          </div>

          <div className="grid grid-cols-2 gap-1.5 text-xs text-muted-foreground">
            <label className="flex items-center gap-1">
              In
              <input
                type="number"
                min={0}
                step={100}
                value={slot.fade.fadeInMs}
                onChange={(e) =>
                  onFadeSettingsChange({
                    fadeInMs: Number(e.target.value),
                    fadeOutMs: slot.fade.fadeOutMs,
                  })
                }
                className="focus-ring w-full min-w-0 rounded border border-border-strong bg-background px-1.5 py-0.5 text-parchment-100 focus:border-ember-400"
              />
            </label>
            <label className="flex items-center gap-1">
              Ut
              <input
                type="number"
                min={0}
                step={100}
                value={slot.fade.fadeOutMs}
                onChange={(e) =>
                  onFadeSettingsChange({
                    fadeInMs: slot.fade.fadeInMs,
                    fadeOutMs: Number(e.target.value),
                  })
                }
                className="focus-ring w-full min-w-0 rounded border border-border-strong bg-background px-1.5 py-0.5 text-parchment-100 focus:border-ember-400"
              />
            </label>
          </div>
        </>
      )}
    </div>
  );
}
