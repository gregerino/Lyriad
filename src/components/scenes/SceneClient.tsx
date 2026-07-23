"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAudioEngine } from "@/audio-engine";
import type { FadeCurve } from "@/audio-engine";
import { MusicSlotRow } from "@/components/slots/MusicSlotRow";
import { OneShotPad } from "@/components/slots/OneShotPad";
import type { SlotLoadState } from "@/components/slots/types";
import { Slider } from "@/components/ui/Slider";
import { PauseIcon, PlayIcon, SpeakerOnIcon } from "@/components/ui/icons";
import { LAST_SCENE_COOKIE } from "@/lib/lastScene";
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
    play,
    pause,
    fadeIn,
    fadeOut,
    stop,
    crossfade,
    setVolume,
    setLoop,
    setMuted,
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

  // Remembers the most recently opened scene so "/" can land back on its mixer view.
  useEffect(() => {
    if (!scene) return;
    const maxAgeSeconds = 60 * 60 * 24 * 365;
    document.cookie = `${LAST_SCENE_COOKIE}=${scene.id}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the id needs to re-trigger this; other scene field edits shouldn't rewrite the cookie
  }, [scene?.id]);

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

  function handleMusicMute(slotIndex: number, muted: boolean) {
    setMuted(musicTrackId(slotIndex), muted);
  }

  function toggleMasterPlayback() {
    const loaded = scene?.musicSlots.filter(
      (s) => musicLoadState[s.slotIndex]?.status === "loaded"
    );
    if (!loaded || loaded.length === 0) return;
    const anyPlaying = loaded.some((s) => tracks[musicTrackId(s.slotIndex)]?.isPlaying);
    for (const s of loaded) {
      const trackId = musicTrackId(s.slotIndex);
      if (anyPlaying) {
        if (tracks[trackId]?.isPlaying) pause(trackId);
      } else {
        play(trackId);
      }
    }
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
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Laddar scen…</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-muted-foreground">Scenen hittades inte.</p>
        <Link href="/scenes" className="text-sm text-ember-400 hover:text-ember-300">
          Tillbaka till scener
        </Link>
      </div>
    );
  }

  if (loadError || !scene) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-wine-400">{loadError ?? "Kunde inte ladda scenen"}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void fetchAll();
          }}
          className="text-sm text-ember-400 hover:text-ember-300"
        >
          Försök igen
        </button>
      </div>
    );
  }

  const loadedMusicTrackIds = scene.musicSlots.filter(
    (s) => musicLoadState[s.slotIndex]?.status === "loaded"
  );
  const anyMusicPlaying = loadedMusicTrackIds.some(
    (s) => tracks[musicTrackId(s.slotIndex)]?.isPlaying
  );
  const filledMusicCount = scene.musicSlots.filter((s) => s.audioFileId).length;
  const filledOneShotCount = scene.oneShotSlots.filter((s) => s.audioFileId).length;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <Link href="/scenes" className="text-xs text-muted-foreground hover:text-parchment-200">
          ← Alla scener
        </Link>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-wide text-parchment-100 sm:text-3xl">
          {scene.name}
        </h1>
        {scene.description && (
          <p className="mt-1 text-sm text-muted-foreground">{scene.description}</p>
        )}
      </div>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-medium tracking-wide text-parchment-100">
            Musik
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            {filledMusicCount}/{scene.musicSlots.length} platser
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-ember-500/25 bg-gradient-to-r from-ember-950/50 to-surface p-4 shadow-sm">
          <button
            type="button"
            onClick={toggleMasterPlayback}
            disabled={loadedMusicTrackIds.length === 0}
            aria-label={anyMusicPlaying ? "Pausa all musik" : "Spela all musik"}
            title={anyMusicPlaying ? "Pausa all musik" : "Spela all musik"}
            className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-gradient-to-b from-ember-400 to-ember-500 text-ink-950 shadow-glow-sm transition hover:shadow-glow disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
          >
            {anyMusicPlaying ? (
              <PauseIcon className="h-5 w-5" />
            ) : (
              <PlayIcon className="h-5 w-5 translate-x-0.5" />
            )}
          </button>

          <div className="min-w-max flex-none">
            <p className="text-sm font-medium text-parchment-100">Master</p>
            <p className="text-xs text-muted-foreground">
              {loadedMusicTrackIds.length === 0
                ? "Inga spår laddade"
                : anyMusicPlaying
                  ? "Spelar"
                  : "Pausad"}
            </p>
          </div>

          <div className="flex flex-1 items-center gap-3 sm:max-w-xs">
            <SpeakerOnIcon className="h-4 w-4 flex-none text-muted-foreground" />
            <Slider
              value={masterVolume}
              onChange={setMasterVolume}
              className="w-full"
              aria-label="Mastervolym"
            />
            <span className="w-10 flex-none text-right font-mono text-xs text-muted-foreground">
              {Math.round(masterVolume * 100)}%
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-flow-col grid-cols-2 grid-rows-5 gap-3">
          {scene.musicSlots.map((slot) => (
            <MusicSlotRow
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
              onMuteChange={(muted) => handleMusicMute(slot.slotIndex, muted)}
              onFadeSettingsChange={(fade) => handleFadeSettingsChange(slot.slotIndex, fade)}
            />
          ))}
        </div>

        {loadedMusicTrackIds.length >= 2 && (
          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <h3 className="text-sm font-medium text-parchment-100">Crossfade</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <select
                value={crossfadeFrom}
                onChange={(e) => setCrossfadeFrom(Number(e.target.value))}
                className="rounded-md border border-border-strong bg-background px-2 py-1 text-parchment-100 focus:border-ember-400 focus:outline-none"
              >
                {loadedMusicTrackIds.map((s) => (
                  <option key={s.slotIndex} value={s.slotIndex}>
                    Musikplats {s.slotIndex}
                  </option>
                ))}
              </select>
              <span className="text-muted-foreground">→</span>
              <select
                value={crossfadeTo}
                onChange={(e) => setCrossfadeTo(Number(e.target.value))}
                className="rounded-md border border-border-strong bg-background px-2 py-1 text-parchment-100 focus:border-ember-400 focus:outline-none"
              >
                {loadedMusicTrackIds.map((s) => (
                  <option key={s.slotIndex} value={s.slotIndex}>
                    Musikplats {s.slotIndex}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                Tid
                <input
                  type="number"
                  min={0}
                  step={100}
                  value={crossfadeMs}
                  onChange={(e) => setCrossfadeMs(Number(e.target.value))}
                  className="w-20 rounded border border-border-strong bg-background px-1.5 py-0.5 text-parchment-100 focus:border-ember-400 focus:outline-none"
                />
                ms
              </label>
              <select
                value={crossfadeCurve}
                onChange={(e) => setCrossfadeCurve(e.target.value as FadeCurve)}
                className="rounded-md border border-border-strong bg-background px-2 py-1 text-xs text-parchment-100 focus:border-ember-400 focus:outline-none"
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
                className="rounded-md bg-gradient-to-b from-ember-400 to-ember-500 px-3 py-1.5 text-sm font-medium text-ink-950 shadow-sm transition hover:shadow-glow-sm disabled:cursor-not-allowed disabled:opacity-40"
              >
                Crossfade
              </button>
            </div>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-medium tracking-wide text-parchment-100">
            One-shots
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            {filledOneShotCount}/{scene.oneShotSlots.length} platser
          </span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8">
          {scene.oneShotSlots.map((slot) => (
            <OneShotPad
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
