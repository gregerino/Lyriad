"use client";

import { useEffect, useState } from "react";
import { Slider } from "@/components/ui/Slider";
import { LoopIcon, PlayIcon, SpeakerOffIcon, SpeakerOnIcon, StopIcon, XIcon } from "@/components/ui/icons";
import { formatDuration } from "@/lib/audio/limits";
import type { TrackState } from "@/audio-engine";
import type { AudioFileWithMeta, MusicSlot } from "@/types/domain";
import { AudioFileSelect } from "./AudioFileSelect";
import type { SlotLoadState } from "./types";

/**
 * How often the playhead re-reads the engine while playing. Position isn't in
 * engine state (it advances continuously), so each playing row polls for it —
 * fast enough to look live, slow enough that ten of them cost nothing.
 */
const POSITION_POLL_MS = 200;

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
  onPlay,
  onStop,
  onSeek,
  getPosition,
  onVolumeChange,
  onLoopChange,
  onMuteChange,
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

  const displayPosition = Math.min(scrubTo ?? position, duration);
  const remaining = Math.max(0, duration - displayPosition);

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
          <div className="flex flex-col gap-1">
            <Slider
              value={Math.round(displayPosition)}
              min={0}
              max={Math.max(1, Math.round(track.duration))}
              step={1}
              onChange={setScrubTo}
              onCommit={commitSeek}
              aria-label="Spola i spåret"
              aria-valuetext={`${formatDuration(displayPosition)} av ${formatDuration(
                track.duration
              )}, ${formatDuration(remaining)} kvar`}
            />
            <div className="flex items-center justify-between font-mono text-[11px] text-muted-foreground">
              <span>{formatDuration(displayPosition)}</span>
              <span title="Tid kvar">-{formatDuration(remaining)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => (track.isPlaying ? onStop() : onPlay())}
              aria-pressed={track.isPlaying}
              aria-label={track.isPlaying ? "Stoppa" : "Spela"}
              title={track.isPlaying ? "Stoppa" : "Spela"}
              className={`focus-ring flex h-8 w-8 flex-none items-center justify-center rounded-md border transition ${
                track.isPlaying
                  ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                  : "border-border-strong text-muted-foreground hover:border-ember-400/40 hover:text-ember-300"
              }`}
            >
              {track.isPlaying ? (
                <StopIcon className="h-4 w-4" />
              ) : (
                <PlayIcon className="h-4 w-4 translate-x-0.5" />
              )}
            </button>

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
        </>
      )}
    </div>
  );
}
