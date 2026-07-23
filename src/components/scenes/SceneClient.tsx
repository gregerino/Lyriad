"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAudioEngine } from "@/audio-engine";
import type { FadeCurve } from "@/audio-engine";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { FavoriteScenesBar } from "@/components/scenes/FavoriteScenesBar";
import { MusicSlotRow } from "@/components/slots/MusicSlotRow";
import { OneShotPad } from "@/components/slots/OneShotPad";
import type { SlotLoadState } from "@/components/slots/types";
import { Slider } from "@/components/ui/Slider";
import { LoopIcon, PauseIcon, PlayIcon, SpeakerOnIcon } from "@/components/ui/icons";
import { LAST_SCENE_COOKIE } from "@/lib/lastScene";
import type {
  AudioFileWithMeta,
  FadeSettings,
  MixPreset,
  MusicSlot,
  OneShotSlot,
  Scene,
} from "@/types/domain";

const musicTrackId = (slotIndex: number) => `music-${slotIndex}`;
const oneshotTrackId = (slotIndex: number) => `oneshot-${slotIndex}`;
const MUSIC_COLUMN_SIZE = 5;
const musicGroupId = (slotIndex: number) => (slotIndex <= MUSIC_COLUMN_SIZE ? "left" : "right");

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

  const [uploaderOpen, setUploaderOpen] = useState(false);

  const [crossfadeFrom, setCrossfadeFrom] = useState(1);
  const [crossfadeTo, setCrossfadeTo] = useState(2);
  const [crossfadeMs, setCrossfadeMs] = useState(3000);
  const [crossfadeCurve, setCrossfadeCurve] = useState<FadeCurve>("linear");

  const [mixPresets, setMixPresets] = useState<MixPreset[]>([]);
  const [savingPreset, setSavingPreset] = useState(false);
  const [presetName, setPresetName] = useState("");
  const [presetSubmitting, setPresetSubmitting] = useState(false);
  const [presetError, setPresetError] = useState<string | null>(null);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);

  const loadedMusicRef = useRef<Record<number, string>>({});
  const loadedOneshotRef = useRef<Record<number, string>>({});
  const persistTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const {
    tracks,
    oneShots,
    masterVolume,
    groups,
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
    setGroupVolume,
    triggerOneShot,
    stopOneShot,
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
      const [sceneRes, filesRes, presetsRes] = await Promise.all([
        fetch(`/api/scenes/${sceneId}`),
        fetch("/api/audio-files"),
        fetch(`/api/scenes/${sceneId}/mix-presets`),
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
      if (presetsRes.ok) {
        const { presets } = await presetsRes.json();
        setMixPresets(presets);
      }
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

  async function loadMusicAudio(slotIndex: number, audioFileId: string, volume: number) {
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
      await loadTrackFromUrl(
        musicTrackId(slotIndex),
        file.filename,
        file.playbackUrl,
        musicGroupId(slotIndex),
        volume
      );
      setMusicLoadState((prev) => ({ ...prev, [slotIndex]: { status: "loaded" } }));
    } catch {
      setMusicLoadState((prev) => ({
        ...prev,
        [slotIndex]: { status: "error", message: `Kunde inte spela upp "${file.filename}"` },
      }));
    }
  }

  async function loadOneshotAudio(slotIndex: number, audioFileId: string, volume: number) {
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
      await loadOneShotFromUrl(oneshotTrackId(slotIndex), file.filename, file.playbackUrl, volume);
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
          void loadMusicAudio(slot.slotIndex, slot.audioFileId, slot.volume);
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
          void loadOneshotAudio(slot.slotIndex, slot.audioFileId, slot.volume);
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
    const result = await patchMusicSlot(slotIndex, { audioFileId, name: null });
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
    const result = await patchMusicSlot(slotIndex, { audioFileId: null, name: null });
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

  function toggleColumnLoop(slotIndexes: number[]) {
    if (!scene) return;
    const allLooping = slotIndexes.every(
      (i) => scene.musicSlots.find((s) => s.slotIndex === i)?.loop
    );
    const next = !allLooping;
    for (const i of slotIndexes) handleMusicLoop(i, next);
  }

  function handleMusicName(slotIndex: number, name: string | null) {
    setScene((prev) =>
      prev
        ? replaceMusicSlot(prev, {
            ...prev.musicSlots.find((s) => s.slotIndex === slotIndex)!,
            name,
          })
        : prev
    );
    void patchMusicSlot(slotIndex, { name });
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

  function fadeOutAllMusic(durationMs: number) {
    for (const track of Object.values(tracks)) {
      if (track.isPlaying) fadeOut(track.id, durationMs);
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

  function applyMixPreset(preset: MixPreset) {
    setMasterVolume(preset.masterVolume);
    for (const [groupId, volume] of Object.entries(preset.groupVolumes)) {
      setGroupVolume(groupId, volume);
    }
    for (const [slotIndexRaw, volume] of Object.entries(preset.slotVolumes)) {
      handleMusicVolume(Number(slotIndexRaw), volume);
    }
  }

  async function saveMixPreset() {
    const trimmedName = presetName.trim();
    if (!trimmedName || !scene) return;
    setPresetSubmitting(true);
    setPresetError(null);
    try {
      const groupVolumes = Object.fromEntries(
        musicColumns.map((column) => [column.id, groups[column.id]?.volume ?? 1])
      );
      const slotVolumes = Object.fromEntries(
        scene.musicSlots
          .filter((s) => s.audioFileId)
          .map((s) => [
            String(s.slotIndex),
            tracks[musicTrackId(s.slotIndex)]?.volume ?? s.volume,
          ])
      );
      const res = await fetch(`/api/scenes/${sceneId}/mix-presets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: trimmedName, masterVolume, groupVolumes, slotVolumes }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Kunde inte spara mixen");
      }
      const { preset } = await res.json();
      setMixPresets((prev) => [...prev, preset]);
      setSavingPreset(false);
      setPresetName("");
    } catch (err) {
      setPresetError(err instanceof Error ? err.message : "Kunde inte spara mixen");
    } finally {
      setPresetSubmitting(false);
    }
  }

  async function deleteMixPreset(presetId: string) {
    setDeletingPresetId(presetId);
    try {
      const res = await fetch(`/api/scenes/${sceneId}/mix-presets/${presetId}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      setMixPresets((prev) => prev.filter((p) => p.id !== presetId));
    } finally {
      setDeletingPresetId(null);
    }
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
        <Link href="/scenes" className="focus-ring rounded-sm text-sm text-ember-400 hover:text-ember-300">
          Tillbaka till scener
        </Link>
      </div>
    );
  }

  if (loadError || !scene) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3">
        <p className="text-sm text-danger-foreground">{loadError ?? "Kunde inte ladda scenen"}</p>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            void fetchAll();
          }}
          className="focus-ring rounded-sm text-sm text-ember-400 hover:text-ember-300"
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
  const musicColumns = [
    {
      id: "left",
      label: "Vänsterkolumnen",
      slots: scene.musicSlots.slice(0, MUSIC_COLUMN_SIZE),
    },
    { id: "right", label: "Högerkolumnen", slots: scene.musicSlots.slice(MUSIC_COLUMN_SIZE) },
  ];

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <Link href="/scenes" className="focus-ring rounded-sm text-xs text-muted-foreground hover:text-parchment-200">
          ← Alla scener
        </Link>
        <h1 className="mt-1 font-display text-2xl font-medium tracking-wide text-parchment-100 sm:text-3xl">
          {scene.name}
        </h1>
        {scene.description && (
          <p className="mt-1 text-sm text-muted-foreground">{scene.description}</p>
        )}
      </div>

      <FavoriteScenesBar currentSceneId={scene.id} />

      {filledMusicCount === 0 && filledOneShotCount === 0 && (
        <p className="rounded-lg border border-dashed border-border-strong/70 bg-surface/50 px-4 py-3 text-sm text-muted-foreground">
          Den här scenen har inga ljud än — ladda upp ovan eller tilldela filer i platserna nedan.
        </p>
      )}

      <section className="rounded-lg border border-border bg-surface p-4 shadow-xs">
        <button
          type="button"
          onClick={() => setUploaderOpen((open) => !open)}
          aria-expanded={uploaderOpen}
          className="focus-ring flex w-full items-center justify-between rounded-md text-left"
        >
          <span className="font-display text-lg font-medium tracking-wide text-parchment-100">
            Ladda upp ljud
          </span>
          <span className="text-xs text-muted-foreground">{uploaderOpen ? "Dölj" : "Visa"}</span>
        </button>
        {uploaderOpen && (
          <div className="mt-3">
            <AudioUploader
              sceneId={sceneId}
              onUploaded={() => void fetchAll()}
              onAssigned={() => void fetchAll()}
            />
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-xl font-medium tracking-wide text-parchment-100">
            Musik
          </h2>
          <span className="font-mono text-xs text-muted-foreground">
            {filledMusicCount}/{scene.musicSlots.length} platser
          </span>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="flex-none font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
            Snabbmix
          </span>
          {mixPresets.map((preset) => (
            <span
              key={preset.id}
              className="inline-flex items-center gap-1 rounded-full border border-border-strong bg-surface pl-3 pr-1.5 py-1 text-xs text-parchment-200 transition hover:border-ember-400/50"
            >
              <button
                type="button"
                onClick={() => applyMixPreset(preset)}
                className="focus-ring rounded-sm font-medium hover:text-ember-300"
                title={`Applicera "${preset.name}"`}
              >
                {preset.name}
              </button>
              <button
                type="button"
                onClick={() => void deleteMixPreset(preset.id)}
                disabled={deletingPresetId === preset.id}
                aria-label={`Ta bort snabbmix ${preset.name}`}
                title="Ta bort snabbmix"
                className="focus-ring flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/80 transition hover:text-danger-foreground disabled:opacity-40"
              >
                ×
              </button>
            </span>
          ))}
          {savingPreset ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-ember-400/40 bg-surface py-1 pl-3 pr-1.5">
              <input
                type="text"
                autoFocus
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void saveMixPreset();
                  if (e.key === "Escape") {
                    setSavingPreset(false);
                    setPresetName("");
                    setPresetError(null);
                  }
                }}
                placeholder="Namn på mixen"
                className="focus-ring w-32 rounded-sm bg-transparent text-xs text-parchment-100 placeholder:text-muted-foreground"
              />
              <button
                type="button"
                onClick={() => void saveMixPreset()}
                disabled={!presetName.trim() || presetSubmitting}
                className="focus-ring rounded-sm text-xs font-medium text-ember-400 hover:text-ember-300 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {presetSubmitting ? "Sparar…" : "Spara"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSavingPreset(false);
                  setPresetName("");
                  setPresetError(null);
                }}
                className="focus-ring flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/80 hover:text-parchment-100"
                aria-label="Avbryt"
              >
                ×
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setSavingPreset(true)}
              className="focus-ring rounded-full border border-dashed border-border-strong px-3 py-1 text-xs text-muted-foreground transition hover:border-ember-400/50 hover:text-ember-300"
            >
              + Spara mix
            </button>
          )}
          {presetError && <p className="w-full text-xs text-danger-foreground">{presetError}</p>}
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-4 rounded-lg border border-ember-500/25 bg-gradient-to-r from-ember-950/50 to-surface p-4 shadow-sm">
          <button
            type="button"
            onClick={toggleMasterPlayback}
            disabled={loadedMusicTrackIds.length === 0}
            aria-label={anyMusicPlaying ? "Pausa all musik" : "Spela all musik"}
            title={anyMusicPlaying ? "Pausa all musik" : "Spela all musik"}
            className="focus-ring flex h-12 w-12 flex-none items-center justify-center rounded-full bg-gradient-to-b from-ember-400 to-ember-500 text-ink-950 shadow-glow-sm transition hover:shadow-glow disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
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

          <div className="flex flex-none items-center gap-1.5">
            <span className="font-mono text-xs text-muted-foreground">Fada ut allt</span>
            <button
              type="button"
              onClick={() => fadeOutAllMusic(3000)}
              disabled={!anyMusicPlaying}
              className="focus-ring rounded-md border border-border-strong px-2 py-1 text-xs text-muted-foreground transition enabled:hover:border-ember-400/60 enabled:hover:text-ember-300 disabled:cursor-not-allowed disabled:opacity-30"
            >
              3s
            </button>
            <button
              type="button"
              onClick={() => fadeOutAllMusic(5000)}
              disabled={!anyMusicPlaying}
              className="focus-ring rounded-md border border-border-strong px-2 py-1 text-xs text-muted-foreground transition enabled:hover:border-ember-400/60 enabled:hover:text-ember-300 disabled:cursor-not-allowed disabled:opacity-30"
            >
              5s
            </button>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {musicColumns.map((column) => {
            const allLooping =
              column.slots.length > 0 && column.slots.every((s) => s.loop);
            const busVolume = groups[column.id]?.volume ?? 1;
            return (
              <div key={column.id} className="flex flex-col gap-3">
                <div className="flex items-center gap-3 rounded-lg border border-border bg-surface px-3 py-2 shadow-xs">
                  <SpeakerOnIcon className="h-4 w-4 flex-none text-muted-foreground" />
                  <Slider
                    value={busVolume}
                    onChange={(v) => setGroupVolume(column.id, v)}
                    className="w-full"
                    aria-label={`Bussvolym för ${column.label.toLowerCase()}`}
                  />
                  <span className="w-9 flex-none text-right font-mono text-xs text-muted-foreground">
                    {Math.round(busVolume * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => toggleColumnLoop(column.slots.map((s) => s.slotIndex))}
                    aria-pressed={allLooping}
                    aria-label={
                      allLooping
                        ? `Stäng av loop för ${column.label.toLowerCase()}`
                        : `Loopa ${column.label.toLowerCase()}`
                    }
                    title="Loopa alla i kolumnen"
                    className={`focus-ring flex h-8 w-8 flex-none items-center justify-center rounded-md border transition ${
                      allLooping
                        ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                        : "border-border-strong text-muted-foreground hover:border-ember-400/40 hover:text-ember-300"
                    }`}
                  >
                    <LoopIcon className="h-4 w-4" />
                  </button>
                </div>

                <div className="flex flex-col gap-3">
                  {column.slots.map((slot) => (
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
                        if (slot.audioFileId)
                          void loadMusicAudio(slot.slotIndex, slot.audioFileId, slot.volume);
                      }}
                      onPlay={() => play(musicTrackId(slot.slotIndex))}
                      onFadeIn={() => fadeIn(musicTrackId(slot.slotIndex), slot.fade.fadeInMs)}
                      onFadeOut={() => fadeOut(musicTrackId(slot.slotIndex), slot.fade.fadeOutMs)}
                      onStop={() => stop(musicTrackId(slot.slotIndex))}
                      onVolumeChange={(volume) => handleMusicVolume(slot.slotIndex, volume)}
                      onLoopChange={(loop) => handleMusicLoop(slot.slotIndex, loop)}
                      onMuteChange={(muted) => handleMusicMute(slot.slotIndex, muted)}
                      onFadeSettingsChange={(fade) => handleFadeSettingsChange(slot.slotIndex, fade)}
                      onRename={(name) => handleMusicName(slot.slotIndex, name)}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        {loadedMusicTrackIds.length >= 2 && (
          <div className="mt-4 rounded-lg border border-border bg-surface p-4">
            <h3 className="text-sm font-medium text-parchment-100">Crossfade</h3>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <select
                value={crossfadeFrom}
                onChange={(e) => setCrossfadeFrom(Number(e.target.value))}
                className="focus-ring rounded-md border border-border-strong bg-background px-2 py-1 text-parchment-100 focus:border-ember-400"
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
                className="focus-ring rounded-md border border-border-strong bg-background px-2 py-1 text-parchment-100 focus:border-ember-400"
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
                  className="focus-ring w-20 rounded border border-border-strong bg-background px-1.5 py-0.5 text-parchment-100 focus:border-ember-400"
                />
                ms
              </label>
              <select
                value={crossfadeCurve}
                onChange={(e) => setCrossfadeCurve(e.target.value as FadeCurve)}
                className="focus-ring rounded-md border border-border-strong bg-background px-2 py-1 text-xs text-parchment-100 focus:border-ember-400"
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
                className="focus-ring rounded-md bg-gradient-to-b from-ember-400 to-ember-500 px-3 py-1.5 text-sm font-medium text-ink-950 shadow-sm transition hover:shadow-glow-sm disabled:cursor-not-allowed disabled:opacity-40"
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
                if (slot.audioFileId)
                  void loadOneshotAudio(slot.slotIndex, slot.audioFileId, slot.volume);
              }}
              onTrigger={() => triggerOneShot(oneshotTrackId(slot.slotIndex))}
              onStop={() => stopOneShot(oneshotTrackId(slot.slotIndex))}
              onVolumeChange={(volume) => handleOneShotVolume(slot.slotIndex, volume)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
