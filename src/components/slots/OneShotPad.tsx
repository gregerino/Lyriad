"use client";

import { useState } from "react";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { Popover } from "@/components/ui/Popover";
import { Slider } from "@/components/ui/Slider";
import { KebabIcon, PlusIcon, SpeakerOnIcon } from "@/components/ui/icons";
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
  onStop: () => void;
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
  onStop,
  onVolumeChange,
}: OneShotPadProps) {
  const [pulseKey, setPulseKey] = useState(0);
  const isActive = Boolean(oneShot && oneShot.activeCount > 0);

  function handlePress() {
    if (isActive) {
      onStop();
      return;
    }
    onTrigger();
    setPulseKey((k) => k + 1);
  }

  if (!slot.audioFileId) {
    return (
      <div className="group relative">
        <Popover
          align="left"
          className="w-full"
          panelClassName="w-72 max-w-[calc(100vw-2rem)]"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label={`Fyll one-shot ${slot.slotIndex}`}
              className="focus-ring flex h-14 w-full items-center justify-center rounded-lg border border-dashed border-border-strong/60 bg-surface/40 text-muted-foreground transition hover:border-ember-400/40 hover:text-ember-300"
            >
              <PlusIcon className="h-4 w-4" />
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
                    category="oneshot"
                    onUploaded={(audioFile) => {
                      onAssign(audioFile.id);
                      close();
                    }}
                  />
                </div>
              </div>
            </div>
          )}
        </Popover>
        {assignError && (
          <p className="mt-1 text-center text-[10px] text-danger-foreground">{assignError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="group relative">
      <button
        type="button"
        onClick={handlePress}
        disabled={loadState.status !== "loaded"}
        aria-pressed={isActive}
        aria-label={
          isActive ? `Stoppa ${shortName(file?.filename)}` : `Spela ${shortName(file?.filename)}`
        }
        className={`focus-ring relative isolate flex h-14 w-full items-center overflow-hidden rounded-lg border px-3 text-left transition enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
          isActive
            ? "border-ember-400/60 bg-ember-400/10"
            : "border-border bg-surface hover:border-border-strong"
        }`}
      >
        <span
          className={`relative z-10 line-clamp-2 pr-4 text-xs font-medium ${
            isActive ? "text-ember-200" : "text-parchment-100"
          }`}
        >
          {shortName(file?.filename)}
        </span>
        {oneShot && oneShot.activeCount > 1 && (
          <span className="absolute bottom-1.5 right-1.5 z-10 rounded-full bg-ember-400 px-1.5 text-[10px] font-semibold text-ink-950">
            {oneShot.activeCount}
          </span>
        )}
        {pulseKey > 0 && (
          <span className="pointer-events-none absolute inset-0 z-0 overflow-hidden rounded-lg">
            <span
              key={pulseKey}
              className="absolute inset-0 bg-ember-400 [animation:pulse-ring_500ms_ease-out_forwards]"
            />
          </span>
        )}
      </button>

      <div className="absolute right-1 top-1 z-20 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
        <Popover
          panelClassName="w-48"
          trigger={({ open, toggle }) => (
            <button
              type="button"
              onClick={toggle}
              aria-expanded={open}
              aria-label={`Alternativ för ${shortName(file?.filename)}`}
              className="focus-ring flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/80 transition hover:bg-ink-700 hover:text-parchment-100"
            >
              <KebabIcon className="h-3 w-3" />
            </button>
          )}
        >
          {({ close }) => (
            <div className="flex flex-col gap-2">
              {oneShot && (
                <label className="flex items-center gap-2 text-xs text-parchment-200">
                  <SpeakerOnIcon className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                  <Slider
                    value={oneShot.volume}
                    onChange={onVolumeChange}
                    className="w-full"
                    aria-label="Volym"
                  />
                </label>
              )}
              {loadState.status === "error" && (
                <button
                  type="button"
                  onClick={onRetry}
                  className="focus-ring rounded-md px-2 py-1.5 text-left text-xs text-ember-400 transition hover:bg-ink-700"
                >
                  Försök igen
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  onClear();
                  close();
                }}
                disabled={assigning}
                className="focus-ring rounded-md px-2 py-1.5 text-left text-xs text-wine-400 transition hover:bg-ink-700 hover:text-wine-300 disabled:opacity-40"
              >
                Rensa plats
              </button>
            </div>
          )}
        </Popover>
      </div>

      {loadState.status === "loading" && (
        <span className="pointer-events-none absolute bottom-1 left-3 z-10 text-[10px] text-muted-foreground">
          Laddar…
        </span>
      )}
      {loadState.status === "error" && (
        <span className="pointer-events-none absolute bottom-1 left-3 z-10 text-[10px] text-danger-foreground">
          Fel
        </span>
      )}
    </div>
  );
}
