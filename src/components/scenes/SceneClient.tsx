"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ONESHOT_GROUP_ID, useAudioEngine } from "@/audio-engine";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { MixerMenu } from "@/components/scenes/MixerMenu";
import { SceneArtwork } from "@/components/scenes/SceneArtwork";
import { SceneTabs } from "@/components/scenes/SceneTabs";
import { MusicSlotCard } from "@/components/slots/MusicSlotCard";
import { OneShotPad } from "@/components/slots/OneShotPad";
import type { SlotLoadState } from "@/components/slots/types";
import { Popover } from "@/components/ui/Popover";
import { Slider } from "@/components/ui/Slider";
import {
  ChevronDownIcon,
  LibraryIcon,
  LoopIcon,
  PauseIcon,
  PlayIcon,
  SpeakerOnIcon,
  UploadIcon,
} from "@/components/ui/icons";
import { LAST_SCENE_COOKIE } from "@/lib/lastScene";
import type {
  AudioFileWithMeta,
  MixPreset,
  MusicSlot,
  OneShotSlot,
  Scene,
} from "@/types/domain";

const musicTrackId = (slotIndex: number) => `music-${slotIndex}`;
const oneshotTrackId = (slotIndex: number) => `oneshot-${slotIndex}`;
const MUSIC_COLUMN_SIZE = 5;
const musicGroupId = (slotIndex: number) => (slotIndex <= MUSIC_COLUMN_SIZE ? "left" : "right");
/** The only fade lengths on offer — deliberately two presets, not a free-form field. */
const FADE_DURATIONS_MS = [3000, 5000];

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

  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  /** Ticked fade length, applied to both directions of master play/pause. */
  const [fadeDurationMs, setFadeDurationMs] = useState<number | null>(null);

  const [mixPresets, setMixPresets] = useState<MixPreset[]>([]);
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
    seek,
    getPosition,
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
        if (!tracks[trackId]?.isPlaying) continue;
        // Fading settles on pause, not stop, so the playhead survives — pressing
        // play again picks up where the fade left off, same as an instant pause.
        if (fadeDurationMs) fadeOut(trackId, fadeDurationMs, { then: "pause" });
        else pause(trackId);
      } else if (fadeDurationMs) {
        fadeIn(trackId, fadeDurationMs);
      } else {
        play(trackId);
      }
    }
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

  /** Resolves to an error message for the caller to show, or null on success. */
  async function saveMixPreset(name: string): Promise<string | null> {
    const trimmedName = name.trim();
    if (!trimmedName || !scene) return "Mixen behöver ett namn";
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
      return null;
    } catch (err) {
      return err instanceof Error ? err.message : "Kunde inte spara mixen";
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
  const filledOneShotCount = scene.oneShotSlots.filter((s) => s.audioFileId).length;
  const musicColumns = [
    {
      id: "left",
      label: "Vänsterkolumnen",
      slots: scene.musicSlots.slice(0, MUSIC_COLUMN_SIZE),
    },
    { id: "right", label: "Högerkolumnen", slots: scene.musicSlots.slice(MUSIC_COLUMN_SIZE) },
  ];

  function renderMusicColumn(column: { id: string; label: string; slots: MusicSlot[] }) {
    const allLooping = column.slots.length > 0 && column.slots.every((s) => s.loop);
    const busVolume = groups[column.id]?.volume ?? 1;
    const isCollapsed = collapsedColumns[column.id] ?? false;

    return (
      <div key={column.id} className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <SpeakerOnIcon className="h-3.5 w-3.5 flex-none text-muted-foreground" />
          <Slider
            value={busVolume}
            onChange={(v) => setGroupVolume(column.id, v)}
            className="w-full"
            aria-label={`Bussvolym för ${column.label.toLowerCase()}`}
          />
          <button
            type="button"
            onClick={() => toggleColumnLoop(column.slots.map((s) => s.slotIndex))}
            aria-pressed={allLooping}
            aria-label={
              allLooping
                ? `Stäng av loop för ${column.label.toLowerCase()}`
                : `Loopa ${column.label.toLowerCase()}`
            }
            className={`focus-ring flex h-7 w-7 flex-none items-center justify-center rounded-md transition ${
              allLooping
                ? "text-ember-300"
                : "text-muted-foreground hover:text-ember-300"
            }`}
          >
            <LoopIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() =>
              setCollapsedColumns((prev) => ({ ...prev, [column.id]: !isCollapsed }))
            }
            aria-expanded={!isCollapsed}
            aria-label={
              isCollapsed
                ? `Visa ${column.label.toLowerCase()}`
                : `Dölj ${column.label.toLowerCase()}`
            }
            className="focus-ring flex h-7 w-7 flex-none items-center justify-center rounded-md text-muted-foreground transition hover:text-parchment-100"
          >
            <ChevronDownIcon className={`h-4 w-4 transition ${isCollapsed ? "" : "rotate-180"}`} />
          </button>
        </div>

        {!isCollapsed && (
          <div className="flex flex-col gap-3">
            {column.slots.map((slot) => (
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
                  if (slot.audioFileId)
                    void loadMusicAudio(slot.slotIndex, slot.audioFileId, slot.volume);
                }}
                onPlay={() => play(musicTrackId(slot.slotIndex))}
                onStop={() => stop(musicTrackId(slot.slotIndex))}
                onSeek={(position) => seek(musicTrackId(slot.slotIndex), position)}
                getPosition={getPosition}
                onVolumeChange={(volume) => handleMusicVolume(slot.slotIndex, volume)}
                onLoopChange={(loop) => handleMusicLoop(slot.slotIndex, loop)}
                onMuteChange={(muted) => handleMusicMute(slot.slotIndex, muted)}
                onRename={(name) => handleMusicName(slot.slotIndex, name)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const oneShotBusVolume = groups[ONESHOT_GROUP_ID]?.volume ?? 1;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-[100rem] flex-col px-4 py-4 sm:px-6">
      <header className="flex items-center gap-3">
        <SceneTabs currentSceneId={scene.id} currentSceneName={scene.name} />

        <div className="flex flex-none items-center gap-2">
          <Link
            href="/library"
            aria-label="Ljudbibliotek"
            title="Ljudbibliotek"
            className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-muted-foreground transition hover:border-ember-400/40 hover:text-ember-300"
          >
            <LibraryIcon className="h-4 w-4" />
          </Link>

          <Popover
            panelClassName="w-80 max-w-[calc(100vw-2rem)]"
            trigger={({ open, toggle }) => (
              <button
                type="button"
                onClick={toggle}
                aria-expanded={open}
                aria-label="Ladda upp ljud"
                title="Ladda upp ljud"
                className={`focus-ring flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                  open
                    ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                    : "border-border-strong text-muted-foreground hover:border-ember-400/40 hover:text-ember-300"
                }`}
              >
                <UploadIcon className="h-4 w-4" />
              </button>
            )}
          >
            <AudioUploader
              sceneId={sceneId}
              onUploaded={() => void fetchAll()}
              onAssigned={() => void fetchAll()}
            />
          </Popover>

          <MixerMenu
            fadeDurationsMs={FADE_DURATIONS_MS}
            fadeDurationMs={fadeDurationMs}
            onFadeDurationChange={setFadeDurationMs}
            presets={mixPresets}
            onApplyPreset={applyMixPreset}
            onDeletePreset={(presetId) => void deleteMixPreset(presetId)}
            deletingPresetId={deletingPresetId}
            onSavePreset={saveMixPreset}
            crossfadeOptions={loadedMusicTrackIds.map((s) => ({
              slotIndex: s.slotIndex,
              label: s.name ?? `Musikplats ${s.slotIndex}`,
            }))}
            onCrossfade={(from, to, durationMs, curve) =>
              crossfade(musicTrackId(from), musicTrackId(to), durationMs, { curve })
            }
          />
        </div>
      </header>

      <div className="mt-6 text-center">
        <h1 className="font-display text-xl font-medium tracking-wide text-parchment-100 sm:text-2xl">
          {scene.name}
        </h1>
        {scene.description && (
          <p className="mt-1 text-xs text-muted-foreground">{scene.description}</p>
        )}
      </div>

      {/* Three columns from tablet width up (iPad portrait is 768–834px), with the
          centre column giving ground first so the two slot columns stay usable. */}
      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,12rem)_minmax(0,1fr)] lg:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)_minmax(0,1fr)]">
        {renderMusicColumn(musicColumns[0])}

        <div className="order-first flex flex-col items-center gap-4 md:order-none">
          <div className="flex w-full items-center gap-2 px-1">
            <SpeakerOnIcon className="h-3.5 w-3.5 flex-none text-muted-foreground" />
            <Slider
              value={masterVolume}
              onChange={setMasterVolume}
              className="w-full"
              aria-label="Mastervolym"
            />
          </div>

          <SceneArtwork sceneId={scene.id} active={anyMusicPlaying} className="max-w-[18rem]" />

          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={toggleMasterPlayback}
              disabled={loadedMusicTrackIds.length === 0}
              aria-label={anyMusicPlaying ? "Pausa all musik" : "Spela all musik"}
              title={anyMusicPlaying ? "Pausa all musik" : "Spela all musik"}
              className="focus-ring flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-ember-400 to-ember-500 text-ink-950 shadow-glow-sm transition hover:shadow-glow disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
            >
              {anyMusicPlaying ? (
                <PauseIcon className="h-5 w-5" />
              ) : (
                <PlayIcon className="h-5 w-5 translate-x-0.5" />
              )}
            </button>
            <p className="text-xs text-muted-foreground">
              {loadedMusicTrackIds.length === 0
                ? "Inga spår laddade"
                : anyMusicPlaying
                  ? "Spelar"
                  : "Pausad"}
            </p>
          </div>
        </div>

        {renderMusicColumn(musicColumns[1])}
      </div>

      <section className="mt-10 border-t border-border pt-5">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="flex-none font-display text-lg font-medium tracking-wide text-parchment-100">
            One-shots
          </h2>
          <span className="flex-none font-mono text-xs text-muted-foreground">
            {filledOneShotCount}/{scene.oneShotSlots.length}
          </span>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:max-w-xs">
            <SpeakerOnIcon className="h-3.5 w-3.5 flex-none text-muted-foreground" />
            <Slider
              value={oneShotBusVolume}
              onChange={(v) => setGroupVolume(ONESHOT_GROUP_ID, v)}
              className="w-full"
              aria-label="Volym för alla one-shots"
            />
          </div>

          <div className="flex flex-none items-center gap-2">
            <Link
              href="/library"
              aria-label="Ljudbibliotek"
              title="Ljudbibliotek"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-muted-foreground transition hover:border-ember-400/40 hover:text-ember-300"
            >
              <LibraryIcon className="h-4 w-4" />
            </Link>
            <Popover
              panelClassName="w-80 max-w-[calc(100vw-2rem)]"
              trigger={({ open, toggle }) => (
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={open}
                  aria-label="Ladda upp one-shot"
                  title="Ladda upp one-shot"
                  className={`focus-ring flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                    open
                      ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                      : "border-border-strong text-muted-foreground hover:border-ember-400/40 hover:text-ember-300"
                  }`}
                >
                  <UploadIcon className="h-4 w-4" />
                </button>
              )}
            >
              <AudioUploader
                category="oneshot"
                sceneId={sceneId}
                onUploaded={() => void fetchAll()}
                onAssigned={() => void fetchAll()}
              />
            </Popover>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10">
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
