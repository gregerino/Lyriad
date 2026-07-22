"use client";

import { useAudioEngine } from "@/audio-engine";
import type { OneShotState } from "@/audio-engine";
import { useState } from "react";

const SLOT_IDS = Array.from({ length: 20 }, (_, i) => `oneshot-${i + 1}`);

export default function TestOneShotsPage() {
  const { oneShots, loadOneShot, triggerOneShot, setOneShotVolume, removeOneShotSlot } =
    useAudioEngine();
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  async function handleFile(slotId: string, file: File | undefined) {
    if (!file) return;
    setErrors((prev) => ({ ...prev, [slotId]: null }));
    try {
      await loadOneShot(slotId, file);
    } catch {
      setErrors((prev) => ({ ...prev, [slotId]: `Kunde inte läsa "${file.name}"` }));
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-950 px-6 py-16 text-zinc-50">
      <div className="w-full max-w-4xl">
        <h1 className="text-2xl font-semibold tracking-tight">One-shots — 20 platser</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Klicka för att trigga direkt. Flera instanser — även av samma ljud, triggat i snabb
          följd — spelar samtidigt och överlappar utan att avbryta varandra.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {SLOT_IDS.map((slotId, i) => (
            <OneShotSlotCard
              key={slotId}
              label={`One-shot ${i + 1}`}
              slot={oneShots[slotId]}
              error={errors[slotId] ?? null}
              onFile={(file) => void handleFile(slotId, file)}
              onTrigger={() => triggerOneShot(slotId)}
              onVolume={(v) => setOneShotVolume(slotId, v)}
              onRemove={() => removeOneShotSlot(slotId)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function OneShotSlotCard({
  label,
  slot,
  error,
  onFile,
  onTrigger,
  onVolume,
  onRemove,
}: {
  label: string;
  slot: OneShotState | undefined;
  error: string | null;
  onFile: (file: File | undefined) => void;
  onTrigger: () => void;
  onVolume: (volume: number) => void;
  onRemove: () => void;
}) {
  const [pulseKey, setPulseKey] = useState(0);

  function handleTrigger() {
    onTrigger();
    setPulseKey((k) => k + 1);
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
      <div className="flex items-center justify-between gap-1">
        <span className="truncate text-xs font-medium text-zinc-300">{label}</span>
        <label className="cursor-pointer text-[11px] text-zinc-500 hover:text-zinc-50">
          <input
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0])}
          />
          {slot ? "Byt" : "Välj"}
        </label>
      </div>

      {error && <p className="text-[10px] text-red-400">{error}</p>}

      <button
        type="button"
        onClick={handleTrigger}
        disabled={!slot}
        className="relative isolate overflow-hidden rounded-md border border-zinc-700 bg-zinc-950 py-4 text-xs font-medium text-zinc-100 enabled:hover:border-zinc-500 disabled:opacity-30"
      >
        <span className="relative z-10 line-clamp-2 px-1">{slot ? slot.name : "Tom"}</span>
        {slot && slot.activeCount > 0 && (
          <span className="absolute right-1 top-1 z-10 rounded-full bg-amber-400 px-1.5 text-[10px] font-semibold text-zinc-950">
            {slot.activeCount}
          </span>
        )}
        {pulseKey > 0 && (
          <span
            key={pulseKey}
            className="pointer-events-none absolute inset-0 rounded-md bg-amber-400 [animation:pulse-ring_500ms_ease-out_forwards]"
          />
        )}
      </button>

      {slot && (
        <>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={slot.volume}
            onChange={(e) => onVolume(Number(e.target.value))}
            className="w-full"
          />
          <button
            type="button"
            onClick={onRemove}
            className="self-start text-[10px] text-zinc-500 hover:text-red-400"
          >
            Ta bort
          </button>
        </>
      )}
    </div>
  );
}
