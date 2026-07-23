"use client";

import { useState } from "react";
import type { OneShotState } from "@/audio-engine";
import type { AudioFileWithMeta, OneShotSlot } from "@/types/domain";
import { AudioFileSelect } from "./AudioFileSelect";
import type { SlotLoadState } from "./types";

type OneShotSlotCardProps = {
  slot: OneShotSlot;
  file: AudioFileWithMeta | null;
  libraryFiles: AudioFileWithMeta[];
  oneShot: OneShotState | undefined;
  loadState: SlotLoadState;
  assigning: boolean;
  assignError: string | null;
  onAssign: (audioFileId: string) => void;
  onClear: () => void;
  onRetry: () => void;
  onTrigger: () => void;
  onVolumeChange: (volume: number) => void;
};

export function OneShotSlotCard({
  slot,
  file,
  libraryFiles,
  oneShot,
  loadState,
  assigning,
  assignError,
  onAssign,
  onClear,
  onRetry,
  onTrigger,
  onVolumeChange,
}: OneShotSlotCardProps) {
  const [pulseKey, setPulseKey] = useState(0);

  function handleTrigger() {
    onTrigger();
    setPulseKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-xs font-medium text-zinc-300">
          One-shot {slot.slotIndex}
        </span>
        {slot.audioFileId && (
          <button
            type="button"
            onClick={onClear}
            disabled={assigning}
            className="text-[11px] text-zinc-500 hover:text-red-400 disabled:opacity-40"
          >
            Rensa
          </button>
        )}
      </div>

      {!slot.audioFileId && (
        <AudioFileSelect files={libraryFiles} disabled={assigning} onSelect={onAssign} />
      )}

      {assignError && <p className="text-[10px] text-red-400">{assignError}</p>}

      {slot.audioFileId && loadState.status === "loading" && (
        <p className="text-[10px] text-zinc-500">Laddar…</p>
      )}
      {slot.audioFileId && loadState.status === "error" && (
        <div className="flex flex-col gap-1">
          <p className="text-[10px] text-red-400">{loadState.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="self-start text-[10px] text-amber-400 hover:text-amber-300"
          >
            Försök igen
          </button>
        </div>
      )}

      {slot.audioFileId && (
        <button
          type="button"
          onClick={handleTrigger}
          disabled={loadState.status !== "loaded"}
          className="relative isolate overflow-hidden rounded-md border border-zinc-700 bg-zinc-950 py-4 text-xs font-medium text-zinc-100 enabled:hover:border-zinc-500 disabled:opacity-30"
        >
          <span className="relative z-10 line-clamp-2 px-1">
            {file?.filename ?? "Okänd fil"}
          </span>
          {oneShot && oneShot.activeCount > 0 && (
            <span className="absolute right-1 top-1 z-10 rounded-full bg-amber-400 px-1.5 text-[10px] font-semibold text-zinc-950">
              {oneShot.activeCount}
            </span>
          )}
          {pulseKey > 0 && (
            <span
              key={pulseKey}
              className="pointer-events-none absolute inset-0 rounded-md bg-amber-400 [animation:pulse-ring_500ms_ease-out_forwards]"
            />
          )}
        </button>
      )}

      {slot.audioFileId && loadState.status === "loaded" && oneShot && (
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={oneShot.volume}
          onChange={(e) => onVolumeChange(Number(e.target.value))}
          className="w-full"
        />
      )}
    </div>
  );
}
