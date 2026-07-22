"use client";

import { useAudioEngine } from "@/audio-engine";
import { useRef, useState } from "react";

export default function TestAudioPage() {
  const { tracks, loadTrack, play, pause, stop, setVolume, setLoop, removeTrack } =
    useAudioEngine();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setError(null);
    for (const file of Array.from(files)) {
      try {
        await loadTrack(crypto.randomUUID(), file);
      } catch {
        setError(`Kunde inte läsa "${file.name}" — är det en giltig ljudfil (mp3/wav/ogg)?`);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  const trackList = Object.values(tracks);

  return (
    <div className="flex min-h-screen flex-col items-center gap-8 bg-zinc-950 px-6 py-16 text-zinc-50">
      <div className="w-full max-w-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Ljudmotor — testvy</h1>
        <p className="mt-1 text-sm text-zinc-400">
          Ladda upp en eller flera ljudfiler och testa uppspelning, loop och volym.
        </p>

        <label className="mt-6 flex cursor-pointer items-center justify-center rounded-lg border border-dashed border-zinc-700 px-4 py-6 text-sm text-zinc-300 hover:border-zinc-500 hover:text-zinc-50">
          <input
            ref={fileInputRef}
            type="file"
            accept="audio/mpeg,audio/wav,audio/ogg,.mp3,.wav,.ogg"
            multiple
            className="hidden"
            onChange={(e) => void handleFiles(e.target.files)}
          />
          Välj ljudfil(er)
        </label>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

        <ul className="mt-6 flex flex-col gap-3">
          {trackList.length === 0 && (
            <li className="text-sm text-zinc-500">Inga spår inlästa än.</li>
          )}
          {trackList.map((track) => (
            <li
              key={track.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-900 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="truncate text-sm font-medium" title={track.name}>
                  {track.name}
                </span>
                <span className="shrink-0 text-xs text-zinc-500">
                  {track.duration.toFixed(1)}s
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => (track.isPlaying ? pause(track.id) : play(track.id))}
                  className="rounded-md bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200"
                >
                  {track.isPlaying ? "Pause" : "Play"}
                </button>
                <button
                  type="button"
                  onClick={() => stop(track.id)}
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-800"
                >
                  Stop
                </button>
                <label className="ml-2 flex items-center gap-1.5 text-sm text-zinc-300">
                  <input
                    type="checkbox"
                    checked={track.loop}
                    onChange={(e) => setLoop(track.id, e.target.checked)}
                  />
                  Loop
                </label>
                <button
                  type="button"
                  onClick={() => removeTrack(track.id)}
                  className="ml-auto text-xs text-zinc-500 hover:text-red-400"
                >
                  Ta bort
                </button>
              </div>

              <label className="flex items-center gap-2 text-xs text-zinc-400">
                Volym
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={track.volume}
                  onChange={(e) => setVolume(track.id, Number(e.target.value))}
                  className="flex-1"
                />
                <span className="w-9 text-right tabular-nums">
                  {Math.round(track.volume * 100)}%
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
