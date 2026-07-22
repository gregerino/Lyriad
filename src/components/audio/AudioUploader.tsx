"use client";

import { useRef, useState } from "react";
import {
  formatBytes,
  isAllowedAudioFilename,
  MAX_AUDIO_UPLOAD_BYTES,
} from "@/lib/audio/limits";
import type { AudioFile, Scene } from "@/types/domain";
import { uploadWithProgress } from "./uploadWithProgress";

type FreeSlot = { kind: "music" | "oneshot"; slotIndex: number };

type Status =
  | { step: "idle" }
  | { step: "uploading"; filename: string; progress: number }
  | { step: "registering"; filename: string }
  | { step: "assign"; audioFile: AudioFile; freeSlots: FreeSlot[] }
  | { step: "assigning"; audioFile: AudioFile; slot: FreeSlot }
  | { step: "done"; audioFile: AudioFile; assignedSlot?: FreeSlot }
  | { step: "error"; message: string };

type AudioUploaderProps = {
  /** When set, a successful upload offers to assign the file to a free slot on this scene. */
  sceneId?: string;
  category?: string | null;
  onUploaded?: (audioFile: AudioFile) => void;
  onAssigned?: (info: { slot: FreeSlot; audioFile: AudioFile }) => void;
};

function slotLabel(slot: FreeSlot): string {
  return slot.kind === "music" ? `Musik ${slot.slotIndex}` : `One-shot ${slot.slotIndex}`;
}

export function AudioUploader({ sceneId, category, onUploaded, onAssigned }: AudioUploaderProps) {
  const [status, setStatus] = useState<Status>({ step: "idle" });
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function computeFreeSlots(): Promise<FreeSlot[]> {
    if (!sceneId) return [];
    const res = await fetch(`/api/scenes/${sceneId}`);
    if (!res.ok) return [];
    const { scene }: { scene: Scene } = await res.json();
    const music = scene.musicSlots
      .filter((s) => s.audioFileId === null)
      .map((s): FreeSlot => ({ kind: "music", slotIndex: s.slotIndex }));
    const oneshot = scene.oneShotSlots
      .filter((s) => s.audioFileId === null)
      .map((s): FreeSlot => ({ kind: "oneshot", slotIndex: s.slotIndex }));
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
          category: category ?? null,
        }),
      });
      if (!registerRes.ok) {
        const body = await registerRes.json().catch(() => null);
        throw new Error(body?.error ?? "Kunde inte spara filmetadata");
      }
      const { audioFile }: { audioFile: AudioFile } = await registerRes.json();
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

  async function handleAssign(audioFile: AudioFile, slot: FreeSlot) {
    if (!sceneId) return;
    setStatus({ step: "assigning", audioFile, slot });
    try {
      const path =
        slot.kind === "music"
          ? `/api/scenes/${sceneId}/music-slots/${slot.slotIndex}`
          : `/api/scenes/${sceneId}/oneshot-slots/${slot.slotIndex}`;
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
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      {(status.step === "idle" || status.step === "error") && (
        <div
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
          className={`flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed p-6 text-center transition-colors ${
            dragActive ? "border-amber-400 bg-zinc-800" : "border-zinc-700 hover:border-zinc-500"
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
          <p className="text-sm text-zinc-300">Släpp en ljudfil här, eller klicka för att välja</p>
          <p className="text-xs text-zinc-500">
            mp3, wav eller ogg — max {formatBytes(MAX_AUDIO_UPLOAD_BYTES)}
          </p>
        </div>
      )}

      {status.step === "error" && (
        <p className="text-xs text-red-400">{status.message}</p>
      )}

      {status.step === "uploading" && (
        <div className="flex flex-col gap-2">
          <p className="truncate text-sm text-zinc-300">Laddar upp {status.filename}…</p>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div
              className="h-full rounded-full bg-amber-400 transition-[width]"
              style={{ width: `${Math.round(status.progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-zinc-500">{Math.round(status.progress * 100)}%</p>
        </div>
      )}

      {status.step === "registering" && (
        <p className="text-sm text-zinc-300">Sparar filmetadata…</p>
      )}

      {status.step === "assign" && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-zinc-300">
            <span className="font-medium text-zinc-100">{status.audioFile.filename}</span>{" "}
            laddades upp. Tilldela en ledig plats i scenen?
          </p>
          <div className="flex flex-wrap gap-2">
            {status.freeSlots.map((slot) => (
              <button
                key={`${slot.kind}-${slot.slotIndex}`}
                type="button"
                onClick={() => void handleAssign(status.audioFile, slot)}
                className="rounded-md border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-xs text-zinc-100 hover:border-amber-400"
              >
                {slotLabel(slot)}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setStatus({ step: "done", audioFile: status.audioFile })}
            className="self-start text-xs text-zinc-500 hover:text-zinc-300"
          >
            Hoppa över
          </button>
        </div>
      )}

      {status.step === "assigning" && (
        <p className="text-sm text-zinc-300">Tilldelar {slotLabel(status.slot)}…</p>
      )}

      {status.step === "done" && (
        <div className="flex flex-col gap-2">
          <p className="text-sm text-zinc-300">
            <span className="font-medium text-zinc-100">{status.audioFile.filename}</span>{" "}
            {status.assignedSlot
              ? `tilldelades ${slotLabel(status.assignedSlot)}.`
              : "laddades upp."}
          </p>
          <button
            type="button"
            onClick={reset}
            className="self-start text-xs text-amber-400 hover:text-amber-300"
          >
            Ladda upp en till
          </button>
        </div>
      )}

    </div>
  );
}
