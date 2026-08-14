"use client";

import { useState } from "react";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { Popover } from "@/components/ui/Popover";
import { RenameMenuItem } from "@/components/ui/RenameMenuItem";
import { Tooltip } from "@/components/ui/Tooltip";
import { VolumeSlider } from "@/components/ui/VolumeSlider";
import { KebabIcon, LoopIcon, PlusIcon, SpeakerOnIcon } from "@/components/ui/icons";
import { stripExtension } from "@/lib/audio/limits";
import type { OneShotState } from "@/audio-engine";
import type { AudioFileWithMeta, Collection, OneShotSlot } from "@/types/domain";
import { AudioFilePicker } from "./AudioFilePicker";
import type { SlotLoadState } from "./types";

const MENU_ITEM_CLASS =
  "focus-ring flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-parchment-200 transition hover:bg-ink-700";

type OneShotPadProps = {
  slot: OneShotSlot;
  file: AudioFileWithMeta | null;
  libraryFiles: AudioFileWithMeta[];
  collections: Collection[];
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
  onLoopChange: (loop: boolean) => void;
  onRename: (name: string | null) => void;
};

export function OneShotPad({
  slot,
  file,
  libraryFiles,
  collections,
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
  onLoopChange,
  onRename,
}: OneShotPadProps) {
  const [pulseKey, setPulseKey] = useState(0);
  const isActive = Boolean(oneShot && oneShot.activeCount > 0);

  // What the pad reads when the slot carries no custom name of its own.
  const fallbackName = file ? stripExtension(file.filename) : "Okänd fil";
  const displayName = slot.name ?? fallbackName;

  function commitName(next: string | null) {
    if (next !== slot.name) onRename(next);
  }

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
          panelClassName="w-80 max-w-[calc(100vw-2rem)]"
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
                  <AudioFilePicker
                    files={libraryFiles}
                    collections={collections}
                    preferredCategory="oneshot"
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
          <p className="mt-1 text-center text-[11px] text-danger-foreground">{assignError}</p>
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
          isActive
            ? `Stoppa ${displayName}`
            : slot.loop
              ? `Spela ${displayName} i loop`
              : `Spela ${displayName}`
        }
        className={`focus-ring relative isolate flex h-14 w-full items-center overflow-hidden rounded-lg border px-3 text-left transition enabled:active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40 ${
          isActive
            ? "border-ember-400/60 bg-ember-400/10"
            : "border-border bg-surface hover:border-border-strong"
        }`}
      >
        <span
          title={file?.filename}
          className={`relative z-10 line-clamp-2 pr-4 text-xs font-medium ${
            isActive ? "text-ember-200" : "text-parchment-100"
          }`}
        >
          {displayName}
        </span>
        {/* A looping pad behaves differently from every other one — it keeps
            going until it is pressed again — so it says so on its face. */}
        {slot.loop && loadState.status === "loaded" && (
          <LoopIcon
            className={`absolute bottom-1 left-3 z-10 h-3 w-3 ${
              isActive ? "text-ember-300" : "text-muted-foreground"
            }`}
          />
        )}
        {oneShot && oneShot.activeCount > 1 && (
          <span className="absolute bottom-1.5 right-1.5 z-10 rounded-full bg-ember-400 px-1.5 text-[11px] font-semibold text-ink-950">
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

      {/* Rename, volume and clear all live behind this button — on a touch
          screen, hiding it until hover hid the pad's entire menu for good. */}
      <div className="hover-reveal absolute right-1 top-1 z-20 transition">
        <Popover
          panelClassName="w-48"
          trigger={({ open, toggle }) => (
            <Tooltip label="Alternativ" align="end">
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-label={`Alternativ för ${displayName}`}
                className="focus-ring flex h-5 w-5 items-center justify-center rounded-full text-muted-foreground/80 transition hover:bg-ink-700 hover:text-parchment-100"
              >
                <KebabIcon className="h-3 w-3" />
              </button>
            </Tooltip>
          )}
        >
          {({ close }) => (
            <div className="flex flex-col gap-2">
              <RenameMenuItem
                value={displayName}
                fallback={fallbackName}
                onCommit={commitName}
                onDone={close}
                itemClassName={MENU_ITEM_CLASS}
              />

              <button
                type="button"
                onClick={() => onLoopChange(!slot.loop)}
                aria-pressed={slot.loop}
                className={`${MENU_ITEM_CLASS} ${slot.loop ? "text-ember-300" : ""}`}
              >
                <LoopIcon className="h-3.5 w-3.5 flex-none" />
                {slot.loop ? "Loop på" : "Loop av"}
              </button>

              {oneShot && (
                <div className="flex items-center gap-2 px-2 text-xs text-parchment-200">
                  <SpeakerOnIcon className="h-3.5 w-3.5 flex-none text-muted-foreground" />
                  <VolumeSlider
                    value={oneShot.volume}
                    onChange={onVolumeChange}
                    className="w-full"
                    aria-label="Volym"
                  />
                </div>
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
        <span className="pointer-events-none absolute bottom-1 left-3 z-10 text-[11px] text-muted-foreground">
          Laddar…
        </span>
      )}
      {loadState.status === "error" && (
        <span className="pointer-events-none absolute bottom-1 left-3 z-10 text-[11px] text-danger-foreground">
          Fel
        </span>
      )}
    </div>
  );
}
