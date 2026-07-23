"use client";

import type { TrackState } from "@/audio-engine";
import type { AudioFileWithMeta, FadeSettings, MusicSlot } from "@/types/domain";
import { AudioFileSelect } from "./AudioFileSelect";
import type { SlotLoadState } from "./types";

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
  onFadeIn: () => void;
  onFadeOut: () => void;
  onStop: () => void;
  onVolumeChange: (volume: number) => void;
  onLoopChange: (loop: boolean) => void;
  onFadeSettingsChange: (fade: FadeSettings) => void;
};

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
  onFadeIn,
  onFadeOut,
  onStop,
  onVolumeChange,
  onLoopChange,
  onFadeSettingsChange,
}: MusicSlotCardProps) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium">Musikplats {slot.slotIndex}</span>
        {slot.audioFileId && (
          <button
            type="button"
            onClick={onClear}
            disabled={assigning}
            className="text-xs text-zinc-500 hover:text-red-400 disabled:opacity-40"
          >
            Rensa
          </button>
        )}
      </div>

      {!slot.audioFileId && (
        <div className="mt-3 flex items-center gap-2">
          <AudioFileSelect files={libraryFiles} disabled={assigning} onSelect={onAssign} />
          {assigning && <span className="text-xs text-zinc-500">Tilldelar…</span>}
        </div>
      )}

      {assignError && <p className="mt-2 text-xs text-red-400">{assignError}</p>}

      {slot.audioFileId && (
        <>
          <p className="mt-2 truncate text-xs text-zinc-400" title={file?.filename}>
            {file?.filename ?? "Okänd fil"}
          </p>

          {loadState.status === "loading" && (
            <p className="mt-2 text-xs text-zinc-500">Laddar ljud…</p>
          )}
          {loadState.status === "error" && (
            <div className="mt-2 flex items-center gap-2">
              <p className="text-xs text-red-400">{loadState.message}</p>
              <button
                type="button"
                onClick={onRetry}
                className="text-xs text-amber-400 hover:text-amber-300"
              >
                Försök igen
              </button>
            </div>
          )}

          {loadState.status === "loaded" && track && (
            <>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={onFadeIn}
                  disabled={track.isPlaying}
                  className="rounded-md bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-40"
                >
                  Fade in
                </button>
                <button
                  type="button"
                  onClick={onFadeOut}
                  disabled={!track.isPlaying}
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-40"
                >
                  Fade out
                </button>
                <button
                  type="button"
                  onClick={onStop}
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
                >
                  Stop
                </button>
                <label className="flex items-center gap-1.5 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={track.loop}
                    onChange={(e) => onLoopChange(e.target.checked)}
                  />
                  Loop
                </label>
                {track.fading && <span className="text-xs text-amber-400">fadar…</span>}
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-zinc-400">
                <label className="flex items-center gap-1.5">
                  Fade in
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
                    className="w-20 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-zinc-100"
                  />
                  ms
                </label>
                <label className="flex items-center gap-1.5">
                  Fade out
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
                    className="w-20 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-zinc-100"
                  />
                  ms
                </label>
              </div>

              <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                Volym
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={track.volume}
                  onChange={(e) => onVolumeChange(Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-9 text-right tabular-nums">
                  {Math.round(track.volume * 100)}%
                </span>
              </label>
            </>
          )}
        </>
      )}
    </div>
  );
}
