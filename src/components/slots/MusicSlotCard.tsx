"use client";

import { useEffect, useState } from "react";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { Popover } from "@/components/ui/Popover";
import { RenameMenuItem } from "@/components/ui/RenameMenuItem";
import { Slider } from "@/components/ui/Slider";
import { Tooltip } from "@/components/ui/Tooltip";
import { VolumeSlider } from "@/components/ui/VolumeSlider";
import {
  KebabIcon,
  LoopIcon,
  PauseIcon,
  PlayIcon,
  PlusIcon,
  SpeakerOffIcon,
  SpeakerOnIcon,
  StopIcon,
} from "@/components/ui/icons";
import { formatDuration, stripExtension } from "@/lib/audio/limits";
import type { TrackState } from "@/audio-engine";
import type { AudioFileWithMeta, Collection, MusicSlot } from "@/types/domain";
import { AudioFilePicker } from "./AudioFilePicker";
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
  collections: Collection[];
  track: TrackState | undefined;
  loadState: SlotLoadState;
  assigning: boolean;
  assignError: string | null;
  onAssign: (audioFileId: string) => void;
  /** Files uploaded from inside the card have to reach the library the desk
      resolves slots against before the assignment does, or the card is left
      holding an id nothing on the page can name. */
  onUploaded: (audioFile: AudioFileWithMeta) => void;
  onClear: () => void;
  onRetry: () => void;
  onPlay: () => void;
  /** Holds the playhead where it is — what the card's own transport button does. */
  onPause: () => void;
  /** Winds the track back to the start; lives in the menu, not on the button. */
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
  collections,
  track,
  loadState,
  assigning,
  assignError,
  onAssign,
  onUploaded,
  onClear,
  onRetry,
  onPlay,
  onPause,
  onStop,
  onSeek,
  getPosition,
  onVolumeChange,
  onLoopChange,
  onMuteChange,
  onRename,
}: MusicSlotCardProps) {
  const ready = Boolean(slot.audioFileId) && loadState.status === "loaded" && Boolean(track);
  // What the card reads when the slot carries no custom name of its own. The
  // extension is dropped here as it is on a one-shot pad: ten cards ending in
  // ".mp3" spend a tenth of the row on the same four characters.
  const fallbackName = file ? stripExtension(file.filename) : "Okänd fil";
  const resolvedName = slot.name ?? fallbackName;

  // Playhead, in seconds. `scrubTo` holds the value being dragged so the poll
  // below can't yank the handle back out from under the user mid-drag.
  const [position, setPosition] = useState(0);
  const [scrubTo, setScrubTo] = useState<number | null>(null);
  const trackId = track?.id;
  const isPlaying = track?.isPlaying ?? false;
  const duration = track?.duration ?? 0;
  // The slot's stored setting stands in until the track is loaded, so the menu
  // and the column's loop button never disagree about a slot in the same scene.
  const looping = track?.loop ?? slot.loop;

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

  function commitName(next: string | null) {
    if (next !== slot.name) onRename(next);
  }

  if (!slot.audioFileId) {
    return (
      <div className="rounded-xl border border-dashed border-border-strong/60 bg-surface/40 transition hover:border-ember-400/40">
        <Popover
          align="left"
          className="w-full"
          panelClassName="w-80 max-w-[calc(100vw-2rem)]"
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
                  <AudioFilePicker
                    files={libraryFiles}
                    collections={collections}
                    preferredCategory="music"
                    disabled={assigning}
                    onSelect={(audioFileId) => {
                      onAssign(audioFileId);
                      close();
                    }}
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
                      // Into the library first, then straight into this slot —
                      // the uploader's own free-slot picker would be a detour
                      // when we already know the target.
                      onUploaded(audioFile);
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
          <p className="px-3 pb-2 text-center text-[11px] text-muted-foreground">Tilldelar…</p>
        )}
        {assignError && (
          <p className="px-3 pb-2 text-center text-[11px] text-danger-foreground">{assignError}</p>
        )}
      </div>
    );
  }

  const displayPosition = Math.min(scrubTo ?? position, duration);
  const remaining = Math.max(0, duration - displayPosition);

  return (
    <div className="rounded-xl border border-border bg-surface px-3 py-2.5 shadow-xs transition hover:border-border-strong">
      <div className="flex items-start gap-3">
        {/* Pause, not stop: the master transport already treats a halt as
            something you resume from, and losing a six-minute track's position
            to a mis-click is a worse default than the menu's explicit stop. */}
        <Tooltip label={isPlaying ? "Pausa" : "Spela"} className="flex-none">
          <button
            type="button"
            onClick={() => (isPlaying ? onPause() : onPlay())}
            disabled={!ready}
            aria-label={isPlaying ? `Pausa ${resolvedName}` : `Spela ${resolvedName}`}
            className={`focus-ring group relative flex h-10 w-10 flex-none items-center justify-center overflow-hidden rounded-md border transition disabled:cursor-not-allowed disabled:opacity-40 ${
              isPlaying
                ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                : "border-border-strong bg-ink-850 text-muted-foreground enabled:hover:border-ember-400/40 enabled:hover:text-ember-300"
            }`}
          >
            {isPlaying ? (
              <PauseIcon className="h-3.5 w-3.5" />
            ) : (
              <PlayIcon className="h-3.5 w-3.5 translate-x-0.5" />
            )}
          </button>
        </Tooltip>

        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3
              title={file?.filename}
              className="min-w-0 flex-1 truncate text-sm font-medium text-parchment-100"
            >
              {resolvedName}
            </h3>

            <Popover
              panelClassName="w-48"
              trigger={({ open, toggle }) => (
                <Tooltip label="Alternativ" align="end" className="-mr-1 flex-none">
                  <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    aria-label={`Alternativ för ${resolvedName}`}
                    className="focus-ring flex h-6 w-6 flex-none items-center justify-center rounded-full text-muted-foreground/80 transition hover:bg-ink-700 hover:text-parchment-100"
                  >
                    <KebabIcon className="h-3.5 w-3.5" />
                  </button>
                </Tooltip>
              )}
            >
              {({ close }) => (
                <div className="flex flex-col gap-0.5">
                  <RenameMenuItem
                    value={resolvedName}
                    fallback={fallbackName}
                    onCommit={commitName}
                    onDone={close}
                    itemClassName={MENU_ITEM_CLASS}
                  />
                  <button
                    type="button"
                    onClick={() => {
                      onStop();
                      close();
                    }}
                    disabled={!isPlaying}
                    className={`${MENU_ITEM_CLASS} disabled:opacity-40`}
                  >
                    <StopIcon className="h-3.5 w-3.5" />
                    Stoppa och spola tillbaka
                  </button>
                  <button
                    type="button"
                    onClick={() => onLoopChange(!looping)}
                    aria-pressed={looping}
                    className={`${MENU_ITEM_CLASS} ${looping ? "text-ember-300" : ""}`}
                  >
                    <LoopIcon className="h-3.5 w-3.5" />
                    {looping ? "Loop på" : "Loop av"}
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

          <div className="flex items-center gap-2">
            <SpeakerOnIcon className="h-3 w-3 flex-none text-muted-foreground" />
            <VolumeSlider
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

      {/* The two faders now stand 24px tall apiece for the sake of a fingertip,
          so the gaps around them come back down to keep the card its old size. */}
      {ready && track && (
        <div className="mt-1 flex items-center gap-2">
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
