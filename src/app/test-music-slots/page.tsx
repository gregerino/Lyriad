"use client";

import { useAudioEngine } from "@/audio-engine";
import type { FadeCurve } from "@/audio-engine";
import { useState } from "react";

const SLOT_IDS = ["slot-1", "slot-2", "slot-3"] as const;
type SlotId = (typeof SLOT_IDS)[number];

const SLOT_LABELS: Record<SlotId, string> = {
  "slot-1": "Musikplats 1",
  "slot-2": "Musikplats 2",
  "slot-3": "Musikplats 3",
};

export default function TestMusicSlotsPage() {
  const { tracks, masterVolume, loadTrack, stop, setVolume, setLoop, fadeIn, fadeOut, crossfade, setMasterVolume } =
    useAudioEngine();

  const [fadeMs, setFadeMs] = useState<Record<SlotId, number>>({
    "slot-1": 2000,
    "slot-2": 2000,
    "slot-3": 2000,
  });
  const [errors, setErrors] = useState<Record<SlotId, string | null>>({
    "slot-1": null,
    "slot-2": null,
    "slot-3": null,
  });

  const [crossfadeFrom, setCrossfadeFrom] = useState<SlotId>("slot-1");
  const [crossfadeTo, setCrossfadeTo] = useState<SlotId>("slot-2");
  const [crossfadeMs, setCrossfadeMs] = useState(3000);
  const [crossfadeCurve, setCrossfadeCurve] = useState<FadeCurve>("linear");

  async function handleFile(slotId: SlotId, file: File | undefined) {
    if (!file) return;
    setErrors((prev) => ({ ...prev, [slotId]: null }));
    try {
      await loadTrack(slotId, file);
    } catch {
      setErrors((prev) => ({
        ...prev,
        [slotId]: `Kunde inte läsa "${file.name}" — är det en giltig ljudfil?`,
      }));
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-950 px-6 py-16 text-zinc-50">
      <div className="w-full max-w-2xl">
        <h1 className="text-2xl font-semibold tracking-tight">Musikplatser — fade &amp; crossfade</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Aktivera flera musikplatser samtidigt, fada in/ut var och en, och testa crossfade mellan
          två.
        </p>

        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <label className="flex items-center gap-3 text-sm text-zinc-300">
            Master volume (påverkar alla platser)
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={masterVolume}
              onChange={(e) => setMasterVolume(Number(e.target.value))}
              className="flex-1"
            />
            <span className="w-10 text-right tabular-nums">{Math.round(masterVolume * 100)}%</span>
          </label>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {SLOT_IDS.map((slotId) => {
            const track = tracks[slotId];
            return (
              <div key={slotId} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-medium">{SLOT_LABELS[slotId]}</span>
                  <label className="cursor-pointer text-xs text-zinc-400 hover:text-zinc-50">
                    <input
                      type="file"
                      accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg"
                      className="hidden"
                      onChange={(e) => void handleFile(slotId, e.target.files?.[0])}
                    />
                    {track ? "Byt fil" : "Välj fil"}
                  </label>
                </div>

                {errors[slotId] && <p className="mt-2 text-xs text-red-400">{errors[slotId]}</p>}

                {track && (
                  <>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => fadeIn(slotId, fadeMs[slotId])}
                        disabled={track.isPlaying}
                        className="rounded-md bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-40"
                      >
                        Fade in
                      </button>
                      <button
                        type="button"
                        onClick={() => fadeOut(slotId, fadeMs[slotId])}
                        disabled={!track.isPlaying}
                        className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800 disabled:opacity-40"
                      >
                        Fade out
                      </button>
                      <button
                        type="button"
                        onClick={() => stop(slotId)}
                        className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
                      >
                        Stop
                      </button>
                      <label className="flex items-center gap-1.5 text-sm text-zinc-300">
                        <input
                          type="checkbox"
                          checked={track.loop}
                          onChange={(e) => setLoop(slotId, e.target.checked)}
                        />
                        Loop
                      </label>
                      <label className="flex items-center gap-1.5 text-xs text-zinc-400">
                        Fade-tid
                        <input
                          type="number"
                          min={0}
                          step={100}
                          value={fadeMs[slotId]}
                          onChange={(e) =>
                            setFadeMs((prev) => ({ ...prev, [slotId]: Number(e.target.value) }))
                          }
                          className="w-20 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-zinc-100"
                        />
                        ms
                      </label>
                      {track.fading && <span className="text-xs text-amber-400">fadar…</span>}
                    </div>

                    <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                      Volym
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.01}
                        value={track.volume}
                        onChange={(e) => setVolume(slotId, Number(e.target.value))}
                        className="flex-1"
                      />
                      <span className="w-9 text-right tabular-nums">
                        {Math.round(track.volume * 100)}%
                      </span>
                    </label>
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-6 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <h2 className="text-sm font-medium">Crossfade</h2>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <select
              value={crossfadeFrom}
              onChange={(e) => setCrossfadeFrom(e.target.value as SlotId)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
            >
              {SLOT_IDS.map((id) => (
                <option key={id} value={id}>
                  {SLOT_LABELS[id]}
                </option>
              ))}
            </select>
            <span className="text-zinc-500">→</span>
            <select
              value={crossfadeTo}
              onChange={(e) => setCrossfadeTo(e.target.value as SlotId)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
            >
              {SLOT_IDS.map((id) => (
                <option key={id} value={id}>
                  {SLOT_LABELS[id]}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs text-zinc-400">
              Tid
              <input
                type="number"
                min={0}
                step={100}
                value={crossfadeMs}
                onChange={(e) => setCrossfadeMs(Number(e.target.value))}
                className="w-20 rounded border border-zinc-700 bg-zinc-950 px-1.5 py-0.5 text-zinc-100"
              />
              ms
            </label>
            <select
              value={crossfadeCurve}
              onChange={(e) => setCrossfadeCurve(e.target.value as FadeCurve)}
              className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs"
            >
              <option value="linear">Linjär</option>
              <option value="exponential">Exponentiell</option>
            </select>
            <button
              type="button"
              onClick={() => crossfade(crossfadeFrom, crossfadeTo, crossfadeMs, { curve: crossfadeCurve })}
              disabled={
                crossfadeFrom === crossfadeTo || !tracks[crossfadeFrom] || !tracks[crossfadeTo]
              }
              className="rounded-md bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-40"
            >
              Crossfade
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
