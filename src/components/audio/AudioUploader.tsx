"use client";

import { useRef, useState } from "react";
import {
  AUDIO_CATEGORIES,
  AUDIO_CATEGORY_LABELS,
  formatBytes,
  isAllowedAudioFilename,
  MAX_AUDIO_UPLOAD_BYTES,
} from "@/lib/audio/limits";
import type { AudioCategory, AudioFileWithMeta, OneShotSet, Scene } from "@/types/domain";
import { uploadWithProgress } from "./uploadWithProgress";

type FreeSlot =
  | { kind: "music"; slotIndex: number }
  | { kind: "oneshot"; slotIndex: number; setId: string; setName: string };

type Status =
  | { step: "idle" }
  | { step: "uploading"; filename: string; progress: number }
  | { step: "registering"; filename: string }
  | { step: "assign"; audioFile: AudioFileWithMeta; freeSlots: FreeSlot[] }
  | { step: "assigning"; audioFile: AudioFileWithMeta; slot: FreeSlot }
  | { step: "done"; audioFile: AudioFileWithMeta; assignedSlot?: FreeSlot }
  | { step: "error"; message: string };

type AudioUploaderProps = {
  /** When set, a successful upload offers to assign the file to a free slot on this scene. */
  sceneId?: string;
  /** The one-shot set "första lediga one-shot" should aim at — the one on screen. */
  oneShotSetId?: string;
  /** When set, locks the category to this value and hides the category selector. */
  category?: AudioCategory | null;
  /**
   * Handed the finished library row, playback URL and all — a caller that means
   * to use the file straight away (a slot filling itself) can then do so without
   * waiting to see it come back round from the library.
   */
  onUploaded?: (audioFile: AudioFileWithMeta) => void;
  onAssigned?: (info: { slot: FreeSlot; audioFile: AudioFileWithMeta }) => void;
};

function slotKey(slot: FreeSlot): string {
  return slot.kind === "music"
    ? `music-${slot.slotIndex}`
    : `oneshot-${slot.setId}-${slot.slotIndex}`;
}

function slotLabel(slot: FreeSlot): string {
  return slot.kind === "music"
    ? `Musik ${slot.slotIndex}`
    : `${slot.setName} · one-shot ${slot.slotIndex}`;
}

/**
 * Where a freshly uploaded file goes. An empty scene has thirty free slots, and
 * offering all thirty as a wall of buttons asks the user to pick a number when
 * what they meant was "the next one" — so the two next ones are the buttons,
 * and picking a particular slot stays available as a list.
 */
function AssignStep({
  audioFile,
  freeSlots,
  category,
  onAssign,
  onSkip,
}: {
  audioFile: AudioFileWithMeta;
  freeSlots: FreeSlot[];
  /** When the uploader is locked to a category, only that kind is offered up front. */
  category: AudioCategory | null;
  onAssign: (slot: FreeSlot) => void;
  onSkip: () => void;
}) {
  const firstMusic = freeSlots.find((s) => s.kind === "music");
  const firstOneShot = freeSlots.find((s) => s.kind === "oneshot");

  const quickSlots = (
    category === "oneshot"
      ? [firstOneShot]
      : category === "music"
        ? [firstMusic]
        : [firstMusic, firstOneShot]
  ).filter((slot): slot is FreeSlot => slot !== undefined);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-parchment-300">
        <span className="font-medium text-parchment-100">{audioFile.filename}</span> laddades upp.
        Tilldela en ledig plats?
      </p>

      <div className="flex flex-wrap gap-2">
        {quickSlots.map((slot) => (
          <button
            key={slotKey(slot)}
            type="button"
            onClick={() => onAssign(slot)}
            className="focus-ring rounded-md border border-border-strong bg-background px-3 py-1.5 text-xs text-parchment-100 transition hover:border-ember-400/60 hover:text-ember-300"
          >
            {slot.kind === "music" ? "Första lediga musikplats" : "Första lediga one-shot"}
            <span className="ml-1.5 font-mono text-muted-foreground">{slot.slotIndex}</span>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <select
          value=""
          onChange={(e) => {
            const chosen = freeSlots.find((s) => slotKey(s) === e.target.value);
            if (chosen) onAssign(chosen);
          }}
          aria-label="Välj en särskild plats"
          className="focus-ring min-w-0 flex-1 rounded-md border border-border-strong bg-background px-2 py-1.5 text-xs text-parchment-100 focus:border-ember-400"
        >
          <option value="">Eller välj en särskild plats…</option>
          {freeSlots.map((slot) => (
            <option key={slotKey(slot)} value={slotKey(slot)}>
              {slotLabel(slot)}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={onSkip}
          className="focus-ring flex-none rounded-sm text-xs text-muted-foreground hover:text-parchment-100"
        >
          Hoppa över
        </button>
      </div>
    </div>
  );
}

export function AudioUploader({
  sceneId,
  oneShotSetId,
  category,
  onUploaded,
  onAssigned,
}: AudioUploaderProps) {
  const [status, setStatus] = useState<Status>({ step: "idle" });
  const [dragActive, setDragActive] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<AudioCategory | null>(null);
  const categoryLocked = category !== undefined;
  const effectiveCategory = categoryLocked ? category : selectedCategory;
  const inputRef = useRef<HTMLInputElement>(null);

  async function computeFreeSlots(): Promise<FreeSlot[]> {
    if (!sceneId) return [];
    // Music slots belong to the scene, one-shot sets to nobody — so the two
    // halves of "where can this go" come from two places.
    const [sceneRes, setsRes] = await Promise.all([
      fetch(`/api/scenes/${sceneId}`),
      fetch("/api/oneshot-sets"),
    ]);
    if (!sceneRes.ok) return [];
    const { scene }: { scene: Scene } = await sceneRes.json();
    const music = scene.musicSlots
      .filter((s) => s.audioFileId === null)
      .map((s): FreeSlot => ({ kind: "music", slotIndex: s.slotIndex }));
    if (!setsRes.ok) return music;
    const { sets: allSets }: { sets: OneShotSet[] } = await setsRes.json();
    // The set on screen comes first, so "första lediga one-shot" lands where the
    // user is looking rather than in whichever set happens to sort first.
    const sets = [...allSets].sort((a, b) =>
      a.id === oneShotSetId ? -1 : b.id === oneShotSetId ? 1 : 0
    );
    const oneshot = sets.flatMap((set) =>
      set.slots
        .filter((s) => s.audioFileId === null)
        .map((s): FreeSlot => ({
          kind: "oneshot",
          slotIndex: s.slotIndex,
          setId: set.id,
          setName: set.name,
        }))
    );
    return [...music, ...oneshot];
  }

  async function handleFile(file: File) {
    if (!isAllowedAudioFilename(file.name)) {
      setStatus({ step: "error", message: "Filtypen stöds inte. Använd mp3, wav eller ogg." });
      return;
    }
    if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
      setStatus({
        step: "error",
        message: `Filen är för stor (${formatBytes(file.size)}). Max är ${formatBytes(MAX_AUDIO_UPLOAD_BYTES)}.`,
      });
      return;
    }

    try {
      setStatus({ step: "uploading", filename: file.name, progress: 0 });

      const uploadUrlRes = await fetch("/api/audio-files/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, sizeBytes: file.size }),
      });
      if (!uploadUrlRes.ok) {
        const body = await uploadUrlRes.json().catch(() => null);
        throw new Error(body?.error ?? "Kunde inte begära uppladdnings-URL");
      }
      const { uploadUrl, r2Key, mimeType } = await uploadUrlRes.json();

      await uploadWithProgress(uploadUrl, file, (progress) =>
        setStatus({ step: "uploading", filename: file.name, progress })
      );

      setStatus({ step: "registering", filename: file.name });

      const registerRes = await fetch("/api/audio-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          sizeBytes: file.size,
          r2Key,
          mimeType,
          category: effectiveCategory ?? null,
        }),
      });
      if (!registerRes.ok) {
        const body = await registerRes.json().catch(() => null);
        throw new Error(body?.error ?? "Kunde inte spara filmetadata");
      }
      const { audioFile }: { audioFile: AudioFileWithMeta } = await registerRes.json();
      onUploaded?.(audioFile);

      const freeSlots = await computeFreeSlots();
      if (freeSlots.length > 0) {
        setStatus({ step: "assign", audioFile, freeSlots });
      } else {
        setStatus({ step: "done", audioFile });
      }
    } catch (err) {
      setStatus({
        step: "error",
        message: err instanceof Error ? err.message : "Uppladdningen misslyckades",
      });
    }
  }

  async function handleAssign(audioFile: AudioFileWithMeta, slot: FreeSlot) {
    if (!sceneId) return;
    setStatus({ step: "assigning", audioFile, slot });
    try {
      const path =
        slot.kind === "music"
          ? `/api/scenes/${sceneId}/music-slots/${slot.slotIndex}`
          : `/api/oneshot-sets/${slot.setId}/slots/${slot.slotIndex}`;
      const res = await fetch(path, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioFileId: audioFile.id }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Kunde inte tilldela platsen");
      }
      onAssigned?.({ slot, audioFile });
      setStatus({ step: "done", audioFile, assignedSlot: slot });
    } catch (err) {
      setStatus({
        step: "error",
        message: err instanceof Error ? err.message : "Kunde inte tilldela platsen",
      });
    }
  }

  function reset() {
    setStatus({ step: "idle" });
    if (!categoryLocked) setSelectedCategory(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-border bg-surface p-4 shadow-xs">
      {(status.step === "idle" || status.step === "error") && !categoryLocked && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Typ:</span>
          {AUDIO_CATEGORIES.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === c ? null : c)}
              className={`focus-ring rounded-md border px-2.5 py-1 transition ${
                selectedCategory === c
                  ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                  : "border-border-strong text-parchment-300 hover:border-ember-400/40"
              }`}
            >
              {AUDIO_CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      )}
      {(status.step === "idle" || status.step === "error") && (
        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragActive(false);
            const file = e.dataTransfer.files?.[0];
            if (file) void handleFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              inputRef.current?.click();
            }
          }}
          className={`focus-ring flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed p-6 text-center transition-colors ${
            dragActive
              ? "border-ember-400 bg-surface-elevated"
              : "border-border-strong hover:border-ember-400/40"
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
            }}
          />
          <p className="text-sm text-parchment-300">Släpp en ljudfil här, eller klicka för att välja</p>
          <p className="text-xs text-muted-foreground">
            mp3, wav eller ogg — max {formatBytes(MAX_AUDIO_UPLOAD_BYTES)}
          </p>
        </div>
      )}

      {status.step === "error" && (
        <p className="text-xs text-danger-foreground">{status.message}</p>
      )}

      {status.step === "uploading" && (
        <div className="flex flex-col gap-2">
          <p className="truncate text-sm text-parchment-300">Laddar upp {status.filename}…</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-ink-700">
            <div
              className="h-full rounded-full bg-gradient-to-r from-ember-500 to-ember-400 transition-[width]"
              style={{ width: `${Math.round(status.progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">{Math.round(status.progress * 100)}%</p>
        </div>
      )}

      {status.step === "registering" && (
        <p className="text-sm text-parchment-300">Sparar filmetadata…</p>
      )}

      {status.step === "assign" && (
        <AssignStep
          audioFile={status.audioFile}
          freeSlots={status.freeSlots}
          category={effectiveCategory ?? null}
          onAssign={(slot) => void handleAssign(status.audioFile, slot)}
          onSkip={() => setStatus({ step: "done", audioFile: status.audioFile })}
        />
      )}

      {status.step === "assigning" && (
        <p className="text-sm text-parchment-300">Tilldelar {slotLabel(status.slot)}…</p>
      )}

      {status.step === "done" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-parchment-300">
            <span className="font-medium text-parchment-100">{status.audioFile.filename}</span>{" "}
            {status.assignedSlot
              ? `tilldelades ${slotLabel(status.assignedSlot)}.`
              : "laddades upp."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="focus-ring self-start rounded-sm text-xs text-ember-400 hover:text-ember-300"
          >
            Ladda upp en till
          </button>
        </div>
      )}

    </div>
  );
}
