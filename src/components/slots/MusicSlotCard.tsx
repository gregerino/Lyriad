"use client";

import { useEffect, useState } from "react";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { Popover } from "@/components/ui/Popover";
import { Slider } from "@/components/ui/Slider";
import {
  KebabIcon,
  LoopIcon,
  PlayIcon,
  PlusIcon,
  SpeakerOffIcon,
  SpeakerOnIcon,
  StopIcon,
} from "@/components/ui/icons";
import { formatDuration } from "@/lib/audio/limits";
import type { TrackState } from "@/audio-engine";
import type { AudioFileWithMeta, MusicSlot } from "@/types/domain";
import { AudioFileSelect } from "./AudioFileSelect";
import type { SlotLoadState } from "./types";

/**
 * How often the playhead re-reads the engine while playing. Position isn't in
 * engine state (it advances continuously), so each playing card polls for it —
 * fast enough to look live, slow enough that ten of them cost nothing.
 */
const POSITION_POLL_MS = 200;

type MusicSlotCardProps = {
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
  onPlay: () => void;
  onStop: () => void;
  onSeek: (positionSeconds: number) => void;
  /** Must be referentially stable — it drives the playhead's polling effect. */
  getPosition: (trackId: string) => number;
  onVolumeChange: (volume: number) => void;
  onLoopChange: (loop: boolean) => void;
  onMuteChange: (muted: boolean) => void;
  onRename: (name: string | null) => void;
};

const MENU_ITEM_CLASS =
  "focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-parchment-200 transition hover:bg-ink-700";

export function MusicSlotCard({
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
  onPlay,
  onStop,
  onSeek,
  getPosition,
  onVolumeChange,
  onLoopChange,
  onMuteChange,
  onRename,
}: MusicSlotCardProps) {
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

  // Playhead, in seconds. `scrubTo` holds the value being dragged so the poll
  // below can't yank the handle back out from under the user mid-drag.
  const [position, setPosition] = useState(0);
  const [scrubTo, setScrubTo] = useState<number | null>(null);
  const trackId = track?.id;
  const isPlaying = track?.isPlaying ?? false;
  const duration = track?.duration ?? 0;

  useEffect(() => {
    if (!trackId) return;
    const sync = () => setPosition(getPosition(trackId));
    sync();
    // A stopped track's position only moves when something else changes it —
    // a seek, or a reassignment — and those re-sync on their own.
    if (!isPlaying) return;
    const timer = setInterval(sync, POSITION_POLL_MS);
    return () => clearInterval(timer);
  }, [trackId, isPlaying, duration, getPosition]);

  function commitSeek(positionSeconds: number) {
    onSeek(positionSeconds);
    setScrubTo(null);
    // Read back rather than trusting the input: the engine clamps, and seeking
    // a non-looping track to its very end finishes it instead (position 0).
    if (trackId) setPosition(getPosition(trackId));
  }

  function commitName() {
    const trimmed = nameDraft.trim();
    const next = trimmed === "" ? null : trimmed;
    if (next !== slot.name) onRename(next);
  }

  if (!slot.audioFileId) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong/60 bg-surface/40 transition hover:border-ember-400/40">
        <Popover
          align="left"
          className="w-full"
          panelClassName="w-72 max-w-[calc(100vw-2rem)]"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label={`Fyll musikplats ${slot.slotIndex}`}
              className="focus-ring flex w-full items-center justify-center gap-2 rounded-xl px-3 py-6 text-muted-foreground transition hover:text-ember-300"
            >
              <PlusIcon className="h-4 w-4" />
              <span className="font-mono text-xs">
                {String(slot.slotIndex).padStart(2, "0")}
              </span>
            </button>
          )}
        >
          {({ close }) => (
            <div className="flex flex-col gap-3">
              <div>
                <h3 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  Från biblioteket
                </h3>
                <div className="mt-2">
                  <AudioFileSelect
                    files={libraryFiles}
                    disabled={assigning}
                    onSelect={(audioFileId) => {
                      onAssign(audioFileId);
                      close();
                    }}
                    placeholder="Välj ljudfil…"
                    className="focus-ring w-full rounded-md border border-border-strong bg-background px-2 py-1.5 text-xs text-parchment-100 focus:border-ember-400 disabled:opacity-40"
                  />
                </div>
              </div>

              <div className="border-t border-border pt-3">
                <h3 className="font-mono text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  Ladda upp
                </h3>
                <div className="mt-2">
                  <AudioUploader
                    category="music"
                    onUploaded={(audioFile) => {
                      // Straight into this slot — the uploader's own free-slot
                      // picker would be a detour when we already know the target.
                      onAssign(audioFile.id);
                      close();
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </Popover>
        {assigning && (
          <p className="px-3 pb-2 text-center text-[10px] text-muted-foreground">Tilldelar…</p>
        )}
        {assignError && (
          <p className="px-3 pb-2 text-center text-[10px] text-danger-foreground">{assignError}</p>
        )}
      </div>
    );
  }

  const displayPosition = Math.min(scrubTo ?? position, duration);
  const remaining = Math.max(0, duration - displayPosition);

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5 shadow-xs transition hover:border-border-strong">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => (isPlaying ? onStop() : onPlay())}
          disabled={!ready}
          aria-label={isPlaying ? `Stoppa ${resolvedName}` : `Spela ${resolvedName}`}
          title={isPlaying ? "Stoppa" : "Spela"}
          className={`focus-ring group relative flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 ${
            isPlaying
              ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
              : "border-border-strong bg-ink-850 text-muted-foreground enabled:hover:border-ember-400/40 enabled:hover:text-ember-300"
          }`}
        >
          {isPlaying ? (
            <StopIcon className="h-3.5 w-3.5" />
          ) : (
            <PlayIcon className="h-3.5 w-3.5 translate-x-0.5" />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
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

            <Popover
              panelClassName="w-48"
              trigger={({ open, toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={open}
                  aria-label={`Alternativ för ${resolvedName}`}
                  className="focus-ring -mr-1 flex h-6 w-6 flex-none items-center justify-center rounded-full text-muted-foreground/80 transition hover:bg-ink-700 hover:text-parchment-100"
                >
                  <KebabIcon className="h-3.5 w-3.5" />
                </button>
              )}
            >
              {({ close }) => (
                <div className="flex flex-col gap-0.5">
                  <button
                    type="button"
                    onClick={() => onLoopChange(!track?.loop)}
                    aria-pressed={track?.loop ?? false}
                    className={`${MENU_ITEM_CLASS} ${track?.loop ? "text-ember-300" : ""}`}
                  >
                    <LoopIcon className="h-3.5 w-3.5" />
                    {track?.loop ? "Loop på" : "Loop av"}
                  </button>
                  <button
                    type="button"
                    onClick={() => onMuteChange(!track?.muted)}
                    aria-pressed={track?.muted ?? false}
                    className={`${MENU_ITEM_CLASS} ${track?.muted ? "text-wine-400" : ""}`}
                  >
                    {track?.muted ? (
                      <SpeakerOffIcon className="h-3.5 w-3.5" />
                    ) : (
                      <SpeakerOnIcon className="h-3.5 w-3.5" />
                    )}
                    {track?.muted ? "Avmuta" : "Muta"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onClear();
                      close();
                    }}
                    disabled={assigning}
                    className={`${MENU_ITEM_CLASS} text-wine-400 hover:text-wine-300 disabled:opacity-40`}
                  >
                    <span className="flex h-3.5 w-3.5 items-center justify-center">×</span>
                    Rensa plats
                  </button>
                </div>
              )}
            </Popover>
          </div>

          <div className="mt-1 flex items-center gap-2">
            <SpeakerOnIcon className="h-3 w-3 flex-none text-muted-foreground" />
            <Slider
              value={track ? track.volume : slot.volume}
              onChange={onVolumeChange}
              className="w-full max-w-[55%]"
              aria-label="Volym"
            />
          </div>
        </div>
      </div>

      {loadState.status === "loading" && (
        <p className="mt-2 text-[11px] text-muted-foreground">Laddar ljud…</p>
      )}
      {loadState.status === "error" && (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <p className="text-[11px] text-danger-foreground">{loadState.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="focus-ring rounded-sm text-[11px] text-ember-400 hover:text-ember-300"
          >
            Försök igen
          </button>
        </div>
      )}

      {ready && track && (
        <div className="mt-2 flex items-center gap-2">
          <Slider
            value={Math.round(displayPosition)}
            min={0}
            max={Math.max(1, Math.round(track.duration))}
            step={1}
            onChange={setScrubTo}
            onCommit={commitSeek}
            className="w-full"
            aria-label="Spola i spåret"
            aria-valuetext={`${formatDuration(displayPosition)} av ${formatDuration(
              track.duration
            )}, ${formatDuration(remaining)} kvar`}
          />
          <span
            title="Tid kvar"
            className="w-14 flex-none text-right font-mono text-[11px] text-muted-foreground"
          >
            {formatDuration(remaining)}
          </span>
        </div>
      )}
    </div>
  );
}
