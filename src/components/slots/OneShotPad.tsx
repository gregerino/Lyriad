"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/Slider";
import { PlusIcon, XIcon } from "@/components/ui/icons";
import type { OneShotState } from "@/audio-engine";
import type { AudioFileWithMeta, OneShotSlot } from "@/types/domain";
import { AudioFileSelect } from "./AudioFileSelect";
import type { SlotLoadState } from "./types";

type OneShotPadProps = {
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

function shortName(filename: string | undefined): string {
  if (!filename) return "Okänd fil";
  return filename.replace(/\.[^./]+$/, "");
}

export function OneShotPad({
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
}: OneShotPadProps) {
  const [pulseKey, setPulseKey] = useState(0);

  function handleTrigger() {
    onTrigger();
    setPulseKey((k) => k + 1);
  }

  if (!slot.audioFileId) {
    return (
      <div className="flex flex-col gap-1">
        <AudioFileSelect
          files={libraryFiles}
          disabled={assigning}
          onSelect={onAssign}
          overlay={
            <div className="flex aspect-[3/2] w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border-strong/70 text-muted-foreground transition group-hover:border-ember-400/50">
              <PlusIcon className="h-4 w-4" />
              <span className="text-[10px] font-medium">Tilldela</span>
            </div>
          }
        />
        {assigning && (
          <span className="text-center text-[10px] text-muted-foreground">Tilldelar…</span>
        )}
        {assignError && <p className="text-center text-[10px] text-wine-400">{assignError}</p>}
      </div>
    );
  }

  return (
    <div className="relative flex aspect-[3/2] flex-col overflow-hidden rounded-lg border border-border bg-surface shadow-xs transition hover:border-border-strong">
      <button
        type="button"
        onClick={onClear}
        disabled={assigning}
        aria-label="Rensa plats"
        title="Rensa plats"
        className="absolute right-1 top-1 z-20 flex h-6 w-6 flex-none items-center justify-center rounded-full text-muted-foreground/80 transition hover:bg-ink-700 hover:text-wine-400 disabled:opacity-30"
      >
        <XIcon className="h-3.5 w-3.5" />
      </button>

      <button
        type="button"
        onClick={handleTrigger}
        disabled={loadState.status !== "loaded"}
        aria-label={`Spela ${shortName(file?.filename)}`}
        className="relative isolate flex flex-1 flex-col items-center justify-center gap-1 overflow-hidden px-2 py-2 text-center transition enabled:hover:border-ember-400/40 enabled:active:scale-[0.97] disabled:opacity-40"
      >
        <span className="relative z-10 line-clamp-2 text-[11px] font-medium text-parchment-100 sm:text-xs">
          {shortName(file?.filename)}
        </span>
        {oneShot && oneShot.activeCount > 0 && (
          <span className="absolute right-1.5 top-1.5 z-10 rounded-full bg-ember-400 px-1.5 text-[10px] font-semibold text-ink-950">
            {oneShot.activeCount}
          </span>
        )}
        {pulseKey > 0 && (
          <span
            key={pulseKey}
            className="pointer-events-none absolute inset-0 z-0 rounded-lg bg-ember-400 [animation:pulse-ring_500ms_ease-out_forwards]"
          />
        )}
      </button>

      {loadState.status === "loading" && (
        <p className="px-2 pb-2 text-center text-[10px] text-muted-foreground">Laddar…</p>
      )}
      {loadState.status === "error" && (
        <div className="flex flex-col items-center gap-0.5 px-2 pb-2">
          <p className="text-center text-[10px] text-wine-400">{loadState.message}</p>
          <button
            type="button"
            onClick={onRetry}
            className="text-[10px] text-ember-400 hover:text-ember-300"
          >
            Försök igen
          </button>
        </div>
      )}
      {loadState.status === "loaded" && oneShot && (
        <div className="px-2 pb-2">
          <Slider
            value={oneShot.volume}
            onChange={onVolumeChange}
            className="w-full"
            aria-label="Volym"
          />
        </div>
      )}
    </div>
  );
}
