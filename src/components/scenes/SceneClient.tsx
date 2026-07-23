"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAudioEngine } from "@/audio-engine";
import type { FadeCurve } from "@/audio-engine";
import { MusicSlotCard } from "@/components/slots/MusicSlotCard";
import { OneShotSlotCard } from "@/components/slots/OneShotSlotCard";
import type { SlotLoadState } from "@/components/slots/types";
import type { AudioFileWithMeta, FadeSettings, MusicSlot, OneShotSlot, Scene } from "@/types/domain";

const musicTrackId = (slotIndex: number) => `music-${slotIndex}`;
const oneshotTrackId = (slotIndex: number) => `oneshot-${slotIndex}`;

function replaceMusicSlot(scene: Scene, slot: MusicSlot): Scene {
  return {
    ...scene,
    musicSlots: scene.musicSlots.map((s) => (s.slotIndex === slot.slotIndex ? slot : s)),
  };
}

function replaceOneShotSlot(scene: Scene, slot: OneShotSlot): Scene {
  return {
    ...scene,
    oneShotSlots: scene.oneShotSlots.map((s) => (s.slotIndex === slot.slotIndex ? slot : s)),
  };
}

type SceneClientProps = { sceneId: string };

export function SceneClient({ sceneId }: SceneClientProps) {
  const [scene, setScene] = useState<Scene | null>(null);
  const [audioFiles, setAudioFiles] = useState<AudioFileWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [musicLoadState, setMusicLoadState] = useState<Record<number, SlotLoadState>>({});
  const [oneshotLoadState, setOneshotLoadState] = useState<Record<number, SlotLoadState>>({});
  const [musicAssigning, setMusicAssigning] = useState<Record<number, boolean>>({});
  const [oneshotAssigning, setOneshotAssigning] = useState<Record<number, boolean>>({});
  const [musicSlotErrors, setMusicSlotErrors] = useState<Record<number, string | null>>({});
  const [oneshotSlotErrors, setOneshotSlotErrors] = useState<Record<number, string | null>>({});

  const [crossfadeFrom, setCrossfadeFrom] = useState(1);
  const [crossfadeTo, setCrossfadeTo] = useState(2);
  const [crossfadeMs, setCrossfadeMs] = useState(3000);
  const [crossfadeCurve, setCrossfadeCurve] = useState<FadeCurve>("linear");

  const loadedMusicRef = useRef<Record<number, string>>({});
  const loadedOneshotRef = useRef<Record<number, string>>({});
  const persistTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const {
    tracks,
    oneShots,
    masterVolume,
    loadTrackFromUrl,
    loadOneShotFromUrl,
    fadeIn,
    fadeOut,
    stop,
    crossfade,
    setVolume,
    setLoop,
    removeTrack,
    setMasterVolume,
    triggerOneShot,
    setOneShotVolume,
    removeOneShotSlot,
  } = useAudioEngine();

  const audioFilesById = useMemo(
    () => new Map(audioFiles.map((f) => [f.id, f])),
    [audioFiles]
  );
  const musicLibraryFiles = useMemo(
    () => audioFiles.filter((f) => f.category === "music" || f.category === null),
    [audioFiles]
  );
  const oneshotLibraryFiles = useMemo(
    () => audioFiles.filter((f) => f.category === "oneshot" || f.category === null),
    [audioFiles]
  );

  async function fetchAll() {
    setLoadError(null);
    try {
      const [sceneRes, filesRes] = await Promise.all([
        fetch(`/api/scenes/${sceneId}`),
        fetch("/api/audio-files"),
      ]);
      if (sceneRes.status === 404) {
        setNotFound(true);
        return;
      }
      if (!sceneRes.ok || !filesRes.ok) throw new Error("Kunde inte ladda scenen");
      const { scene: sceneData } = await sceneRes.json();
      const { audioFiles: files } = await filesRes.json();
      setScene(sceneData);
      setAudioFiles(files);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Kunde inte ladda scenen");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial fetch-on-mount, no external subscription to hang this off
    void fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- fetchAll only depends on sceneId, which is stable for the component's lifetime (page.tsx keys on it)
  }, [sceneId]);

  async function loadMusicAudio(slotIndex: number, audioFileId: string) {
    const file = audioFilesById.get(audioFileId);
    if (!file) {
      setMusicLoadState((prev) => ({
        ...prev,
        [slotIndex]: { status: "error", message: "Ljudfilen hittades inte i biblioteket" },
      }));
      return;
    }
    setMusicLoadState((prev) => ({ ...prev, [slotIndex]: { status: "loading" } }));
    try {
      await loadTrackFromUrl(musicTrackId(slotIndex), file.filename, file.playbackUrl);
      setMusicLoadState((prev) => ({ ...prev, [slotIndex]: { status: "loaded" } }));
    } catch {
      setMusicLoadState((prev) => ({
        ...prev,
        [slotIndex]: { status: "error", message: `Kunde inte spela upp "${file.filename}"` },
      }));
    }
  }

  async function loadOneshotAudio(slotIndex: number, audioFileId: string) {
    const file = audioFilesById.get(audioFileId);
    if (!file) {
      setOneshotLoadState((prev) => ({
        ...prev,
        [slotIndex]: { status: "error", message: "Ljudfilen hittades inte i biblioteket" },
      }));
      return;
    }
    setOneshotLoadState((prev) => ({ ...prev, [slotIndex]: { status: "loading" } }));
    try {
      await loadOneShotFromUrl(oneshotTrackId(slotIndex), file.filename, file.playbackUrl);
      setOneshotLoadState((prev) => ({ ...prev, [slotIndex]: { status: "loaded" } }));
    } catch {
      setOneshotLoadState((prev) => ({
        ...prev,
        [slotIndex]: { status: "error", message: `Kunde inte spela upp "${file.filename}"` },
      }));
    }
  }

  // Keeps the audio engine in sync with the scene's persisted slot assignments:
  // loads newly-assigned files, tears down cleared ones. Guarded by refs (not
  // engine state) so it only reacts to actual assignment changes, not volume/loop edits.
  useEffect(() => {
    if (!scene) return;
    for (const slot of scene.musicSlots) {
      const trackId = musicTrackId(slot.slotIndex);
      if (slot.audioFileId) {
        if (loadedMusicRef.current[slot.slotIndex] !== slot.audioFileId) {
          loadedMusicRef.current[slot.slotIndex] = slot.audioFileId;
          void loadMusicAudio(slot.slotIndex, slot.audioFileId);
        }
      } else if (loadedMusicRef.current[slot.slotIndex]) {
        delete loadedMusicRef.current[slot.slotIndex];
        removeTrack(trackId);
        setMusicLoadState((prev) => ({ ...prev, [slot.slotIndex]: { status: "idle" } }));
      }
    }
    for (const slot of scene.oneShotSlots) {
      const trackId = oneshotTrackId(slot.slotIndex);
      if (slot.audioFileId) {
        if (loadedOneshotRef.current[slot.slotIndex] !== slot.audioFileId) {
          loadedOneshotRef.current[slot.slotIndex] = slot.audioFileId;
          void loadOneshotAudio(slot.slotIndex, slot.audioFileId);
        }
      } else if (loadedOneshotRef.current[slot.slotIndex]) {
        delete loadedOneshotRef.current[slot.slotIndex];
        removeOneShotSlot(trackId);
        setOneshotLoadState((prev) => ({ ...prev, [slot.slotIndex]: { status: "idle" } }));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-runs only on scene/audioFilesById changes; engine calls are ref-guarded above
  }, [scene, audioFilesById]);

  function schedulePersist(key: string, fn: () => void, delay = 500) {
    const timers = persistTimers.current;
    if (timers[key]) clearTimeout(timers[key]);
    timers[key] = setTimeout(fn, delay);
  }

  useEffect(() => {
    const timers = persistTimers.current;
    return () => {
      for (const timer of Object.values(timers)) clearTimeout(timer);
    };
  }, []);

  async function patchMusicSlot(
    slotIndex: number,
    body: Record<string, unknown>
  ): Promise<{ ok: boolean; status: number; error?: string }> {
    try {
      const res = await fetch(`/api/scenes/${sceneId}/music-slots/${slotIndex}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        return { ok: false, status: res.status, error: errBody?.error };
      }
      const { slot } = await res.json();
      setScene((prev) => (prev ? replaceMusicSlot(prev, slot) : prev));
      return { ok: true, status: res.status };
    } catch {
      return { ok: false, status: 0, error: "Nätverksfel" };
    }
  }

  async function patchOneShotSlot(
    slotIndex: number,
    body: Record<string, unknown>
  ): Promise<{ ok: boolean; status: number; error?: string }> {
    try {
      const res = await fetch(`/api/scenes/${sceneId}/oneshot-slots/${slotIndex}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => null);
        return { ok: false, status: res.status, error: errBody?.error };
      }
      const { slot } = await res.json();
      setScene((prev) => (prev ? replaceOneShotSlot(prev, slot) : prev));
      return { ok: true, status: res.status };
    } catch {
      return { ok: false, status: 0, error: "Nätverksfel" };
    }
  }

  async function assignMusicSlot(slotIndex: number, audioFileId: string) {
    setMusicAssigning((prev) => ({ ...prev, [slotIndex]: true }));
    setMusicSlotErrors((prev) => ({ ...prev, [slotIndex]: null }));
    const result = await patchMusicSlot(slotIndex, { audioFileId });
    if (!result.ok) {
      if (result.status === 409) {
        setMusicSlotErrors((prev) => ({
          ...prev,
          [slotIndex]: "Platsen är redan upptagen av en annan fil.",
        }));
        await fetchAll();
      } else {
        setMusicSlotErrors((prev) => ({
          ...prev,
          [slotIndex]: result.error ?? "Kunde inte tilldela platsen",
        }));
      }
    }
    setMusicAssigning((prev) => ({ ...prev, [slotIndex]: false }));
  }

  async function clearMusicSlot(slotIndex: number) {
    setMusicAssigning((prev) => ({ ...prev, [slotIndex]: true }));
    const result = await patchMusicSlot(slotIndex, { audioFileId: null });
    if (result.ok) setMusicSlotErrors((prev) => ({ ...prev, [slotIndex]: null }));
    setMusicAssigning((prev) => ({ ...prev, [slotIndex]: false }));
  }

  async function assignOneShotSlot(slotIndex: number, audioFileId: string) {
    setOneshotAssigning((prev) => ({ ...prev, [slotIndex]: true }));
    setOneshotSlotErrors((prev) => ({ ...prev, [slotIndex]: null }));
    const result = await patchOneShotSlot(slotIndex, { audioFileId });
    if (!result.ok) {
      if (result.status === 409) {
        setOneshotSlotErrors((prev) => ({
          ...prev,
          [slotIndex]: "Platsen är redan upptagen av en annan fil.",
        }));
        await fetchAll();
      } else {
        setOneshotSlotErrors((prev) => ({
          ...prev,
          [slotIndex]: result.error ?? "Kunde inte tilldela platsen",
        }));
      }
    }
    setOneshotAssigning((prev) => ({ ...prev, [slotIndex]: false }));
  }

  async function clearOneShotSlot(slotIndex: number) {
    setOneshotAssigning((prev) => ({ ...prev, [slotIndex]: true }));
    const result = await patchOneShotSlot(slotIndex, { audioFileId: null });
    if (result.ok) setOneshotSlotErrors((prev) => ({ ...prev, [slotIndex]: null }));
    setOneshotAssigning((prev) => ({ ...prev, [slotIndex]: false }));
  }

  function handleMusicVolume(slotIndex: number, volume: number) {
    const trackId = musicTrackId(slotIndex);
    if (tracks[trackId]) setVolume(trackId, volume);
    setScene((prev) =>
      prev
        ? replaceMusicSlot(prev, {
            ...prev.musicSlots.find((s) => s.slotIndex === slotIndex)!,
            volume,
          })
        : prev
    );
    schedulePersist(`music-volume-${slotIndex}`, () => void patchMusicSlot(slotIndex, { volume }));
  }

  function handleMusicLoop(slotIndex: number, loop: boolean) {
    const trackId = musicTrackId(slotIndex);
    if (tracks[trackId]) setLoop(trackId, loop);
    setScene((prev) =>
      prev
        ? replaceMusicSlot(prev, {
            ...prev.musicSlots.find((s) => s.slotIndex === slotIndex)!,
            loop,
          })
        : prev
    );
    void patchMusicSlot(slotIndex, { loop });
  }

  function handleFadeSettingsChange(slotIndex: number, fade: FadeSettings) {
    setScene((prev) =>
      prev
        ? replaceMusicSlot(prev, {
            ...prev.musicSlots.find((s) => s.slotIndex === slotIndex)!,
            fade,
          })
        : prev
    );
    schedulePersist(`music-fade-${slotIndex}`, () => void patchMusicSlot(slotIndex, { fade }));
  }

  function handleOneShotVolume(slotIndex: number, volume: number) {
    const trackId = oneshotTrackId(slotIndex);
    if (oneShots[trackId]) setOneShotVolume(trackId, volume);
    setScene((prev) =>
      prev
        ? replaceOneShotSlot(prev, {
            ...prev.oneShotSlots.find((s) => s.slotIndex === slotIndex)!,
            volume,
          })
        : prev
    );
    schedulePersist(`oneshot-volume-${slotIndex}`, () =>
      void patchOneShotSlot(slotIndex, { volume })
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 text-zinc-50">
        <p className="text-sm text-zinc-400">Laddar scen…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-50">
        <p className="text-sm text-zinc-400">Scenen hittades inte.</p>
        <Link href="/scenes" className="text-sm text-amber-400 hover:text-amber-300">
          Tillbaka till scener
        </Link>
      </div>
    );
  }

  if (loadError || !scene) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-50">
        <p className="text-sm text-red-400">{loadError ?? "Kunde inte ladda scenen"}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void fetchAll();
          }}
          className="text-sm text-amber-400 hover:text-amber-300"
        >
          Försök igen
        </button>
      </div>
    );
  }

  const loadedMusicTrackIds = scene.musicSlots.filter(
    (s) => musicLoadState[s.slotIndex]?.status === "loaded"
  );

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-8 bg-zinc-950 px-6 py-12 text-zinc-50">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/scenes" className="text-xs text-zinc-500 hover:text-zinc-300">
            ← Alla scener
          </Link>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{scene.name}</h1>
          {scene.description && <p className="mt-1 text-sm text-zinc-400">{scene.description}</p>}
        </div>
        <Link href="/library" className="text-sm text-zinc-400 hover:text-zinc-50">
          Ljudbibliotek →
        </Link>
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
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

      <section>
        <h2 className="text-lg font-medium tracking-tight">Musikplatser</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          {scene.musicSlots.map((slot) => (
            <MusicSlotCard
              key={slot.slotIndex}
              slot={slot}
              file={slot.audioFileId ? (audioFilesById.get(slot.audioFileId) ?? null) : null}
              libraryFiles={musicLibraryFiles}
              track={tracks[musicTrackId(slot.slotIndex)]}
              loadState={musicLoadState[slot.slotIndex] ?? { status: "idle" }}
              assigning={musicAssigning[slot.slotIndex] ?? false}
              assignError={musicSlotErrors[slot.slotIndex] ?? null}
              onAssign={(audioFileId) => void assignMusicSlot(slot.slotIndex, audioFileId)}
              onClear={() => void clearMusicSlot(slot.slotIndex)}
              onRetry={() => {
                if (slot.audioFileId) void loadMusicAudio(slot.slotIndex, slot.audioFileId);
              }}
              onFadeIn={() => fadeIn(musicTrackId(slot.slotIndex), slot.fade.fadeInMs)}
              onFadeOut={() => fadeOut(musicTrackId(slot.slotIndex), slot.fade.fadeOutMs)}
              onStop={() => stop(musicTrackId(slot.slotIndex))}
              onVolumeChange={(volume) => handleMusicVolume(slot.slotIndex, volume)}
              onLoopChange={(loop) => handleMusicLoop(slot.slotIndex, loop)}
              onFadeSettingsChange={(fade) => handleFadeSettingsChange(slot.slotIndex, fade)}
            />
          ))}
        </div>

        {loadedMusicTrackIds.length >= 2 && (
          <div className="mt-4 rounded-lg border border-zinc-800 bg-zinc-900 p-4">
            <h3 className="text-sm font-medium">Crossfade</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <select
                value={crossfadeFrom}
                onChange={(e) => setCrossfadeFrom(Number(e.target.value))}
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
              >
                {loadedMusicTrackIds.map((s) => (
                  <option key={s.slotIndex} value={s.slotIndex}>
                    Musikplats {s.slotIndex}
                  </option>
                ))}
              </select>
              <span className="text-zinc-500">→</span>
              <select
                value={crossfadeTo}
                onChange={(e) => setCrossfadeTo(Number(e.target.value))}
                className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1"
              >
                {loadedMusicTrackIds.map((s) => (
                  <option key={s.slotIndex} value={s.slotIndex}>
                    Musikplats {s.slotIndex}
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
                onClick={() =>
                  crossfade(musicTrackId(crossfadeFrom), musicTrackId(crossfadeTo), crossfadeMs, {
                    curve: crossfadeCurve,
                  })
                }
                disabled={crossfadeFrom === crossfadeTo}
                className="rounded-md bg-zinc-50 px-3 py-1.5 text-sm font-medium text-zinc-950 hover:bg-zinc-200 disabled:opacity-40"
              >
                Crossfade
              </button>
            </div>
          </div>
        )}
      </section>

      <section>
        <h2 className="text-lg font-medium tracking-tight">One-shots</h2>
        <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
          {scene.oneShotSlots.map((slot) => (
            <OneShotSlotCard
              key={slot.slotIndex}
              slot={slot}
              file={slot.audioFileId ? (audioFilesById.get(slot.audioFileId) ?? null) : null}
              libraryFiles={oneshotLibraryFiles}
              oneShot={oneShots[oneshotTrackId(slot.slotIndex)]}
              loadState={oneshotLoadState[slot.slotIndex] ?? { status: "idle" }}
              assigning={oneshotAssigning[slot.slotIndex] ?? false}
              assignError={oneshotSlotErrors[slot.slotIndex] ?? null}
              onAssign={(audioFileId) => void assignOneShotSlot(slot.slotIndex, audioFileId)}
              onClear={() => void clearOneShotSlot(slot.slotIndex)}
              onRetry={() => {
                if (slot.audioFileId) void loadOneshotAudio(slot.slotIndex, slot.audioFileId);
              }}
              onTrigger={() => triggerOneShot(oneshotTrackId(slot.slotIndex))}
              onVolumeChange={(volume) => handleOneShotVolume(slot.slotIndex, volume)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
