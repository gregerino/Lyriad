"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ONESHOT_GROUP_ID, useAudioEngine } from "@/audio-engine";
import { AudioUploader } from "@/components/audio/AudioUploader";
import { MixerMenu } from "@/components/scenes/MixerMenu";
import { OneShotSetTabs } from "@/components/scenes/OneShotSetTabs";
import { SceneArtwork } from "@/components/scenes/SceneArtwork";
import { SceneTabs } from "@/components/scenes/SceneTabs";
import { MusicSlotCard } from "@/components/slots/MusicSlotCard";
import { OneShotPad } from "@/components/slots/OneShotPad";
import type { SlotLoadState } from "@/components/slots/types";
import { NoticeBar, useNotice } from "@/components/ui/Notice";
import { Popover } from "@/components/ui/Popover";
import { Tooltip } from "@/components/ui/Tooltip";
import { VolumeSlider } from "@/components/ui/VolumeSlider";
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
import { useStoredSetting } from "@/lib/useStoredSetting";
import type {
  AudioFileWithMeta,
  Collection,
  MixPreset,
  MusicSlot,
  OneShotSet,
  OneShotSlot,
  Scene,
} from "@/types/domain";

const musicTrackId = (slotIndex: number) => `music-${slotIndex}`;
/**
 * One-shot pads are addressed by set as well as by slot: two sets can hold the
 * same slot number, and the engine must be able to keep both loaded — a
 * looping pad in one set goes on playing while you work in another.
 */
const oneshotTrackId = (setId: string, slotIndex: number) => `oneshot-${setId}-${slotIndex}`;
const MUSIC_COLUMN_SIZE = 5;
const musicGroupId = (slotIndex: number) => (slotIndex <= MUSIC_COLUMN_SIZE ? "left" : "right");
/** The only fade lengths on offer — deliberately two presets, not a free-form field. */
const FADE_DURATIONS_MS = [3000, 5000];

/** What "Återställ ljud" puts the desk back to. Slots match the column default. */
const DEFAULT_BUS_VOLUME = 1;
const DEFAULT_SLOT_VOLUME = 0.8;

/**
 * Both of these are how the user likes to work rather than anything about a
 * particular scene, so they follow the browser rather than the scene row.
 */
const FADE_SETTING_KEY = "lyriad:fade-duration-ms";
const EMPTY_PADS_SETTING_KEY = "lyriad:show-empty-oneshots";
/** Which one-shot set this scene was left on, per browser. */
const ACTIVE_SET_KEY = (sceneId: string) => `lyriad:oneshot-set:${sceneId}`;

/** How far down the page the mixer has to go before the compact transport takes over. */
const APP_HEADER_HEIGHT_PX = 56;

function replaceMusicSlot(scene: Scene, slot: MusicSlot): Scene {
  return {
    ...scene,
    musicSlots: scene.musicSlots.map((s) => (s.slotIndex === slot.slotIndex ? slot : s)),
  };
}

function replaceOneShotSlot(scene: Scene, slot: OneShotSlot): Scene {
  return {
    ...scene,
    oneShotSets: scene.oneShotSets.map((set) =>
      set.id === slot.setId
        ? { ...set, slots: set.slots.map((s) => (s.slotIndex === slot.slotIndex ? slot : s)) }
        : set
    ),
  };
}

/** The stored slot as the scene currently has it — the value an optimistic edit reverts to. */
function findOneShotSlot(scene: Scene, setId: string, slotIndex: number): OneShotSlot | undefined {
  return scene.oneShotSets
    .find((set) => set.id === setId)
    ?.slots.find((slot) => slot.slotIndex === slotIndex);
}

type SceneClientProps = { sceneId: string };

export function SceneClient({ sceneId }: SceneClientProps) {
  const router = useRouter();

  const { notify, notice, dismiss } = useNotice();

  const [scene, setScene] = useState<Scene | null>(null);
  const [audioFiles, setAudioFiles] = useState<AudioFileWithMeta[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);

  const [musicLoadState, setMusicLoadState] = useState<Record<number, SlotLoadState>>({});
  const [musicAssigning, setMusicAssigning] = useState<Record<number, boolean>>({});
  const [musicSlotErrors, setMusicSlotErrors] = useState<Record<number, string | null>>({});
  // One-shot state is keyed by the pad's engine id, which carries its set — the
  // same slot number exists in every set of the scene.
  const [oneshotLoadState, setOneshotLoadState] = useState<Record<string, SlotLoadState>>({});
  const [oneshotAssigning, setOneshotAssigning] = useState<Record<string, boolean>>({});
  const [oneshotSlotErrors, setOneshotSlotErrors] = useState<Record<string, string | null>>({});
  const [creatingSet, setCreatingSet] = useState(false);

  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  /** Ticked fade length, applied to both directions of master play/pause. */
  const [fadeDurationMs, setFadeDurationMs] = useStoredSetting<number | null>(
    FADE_SETTING_KEY,
    null
  );
  /**
   * Whether the pad grid shows all twenty slots or only what is filled. A scene
   * with three sounds in it was otherwise seventeen dashed rectangles.
   */
  const [showEmptyPads, setShowEmptyPads] = useStoredSetting(EMPTY_PADS_SETTING_KEY, false);
  /**
   * The set the pad grid is showing. Remembered per scene: a table that ended
   * last week in "Strid" opens there again rather than back on the first set.
   */
  const [storedSetId, setStoredSetId] = useStoredSetting<string | null>(
    ACTIVE_SET_KEY(sceneId),
    null
  );

  /** True once the desk's own transport has scrolled out from under the header. */
  const [transportOffscreen, setTransportOffscreen] = useState(false);
  const compactTransportAnchors = useRef(new Set<Element>());
  const mobileTransportRef = useRef<HTMLDivElement>(null);
  const deskTransportRef = useRef<HTMLDivElement>(null);

  const [mixPresets, setMixPresets] = useState<MixPreset[]>([]);
  const [deletingPresetId, setDeletingPresetId] = useState<string | null>(null);
  const [deletingScene, setDeletingScene] = useState(false);

  const loadedMusicRef = useRef<Record<number, string>>({});
  /** Engine pad id → the audio file id currently decoded into it. */
  const loadedOneshotRef = useRef<Record<string, string>>({});
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
    setOneShotLoop,
    removeOneShotSlot,
  } = useAudioEngine();

  /** Falls back to the first set whenever the remembered one is gone. */
  const activeSet =
    scene?.oneShotSets.find((set) => set.id === storedSetId) ?? scene?.oneShotSets[0] ?? null;

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
      const [sceneRes, filesRes, presetsRes, collectionsRes] = await Promise.all([
        fetch(`/api/scenes/${sceneId}`),
        fetch("/api/audio-files"),
        fetch(`/api/scenes/${sceneId}/mix-presets`),
        fetch("/api/collections"),
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
      // Only used to filter the slot pickers, so a failure here costs the
      // picker its collection filter rather than the whole scene.
      if (collectionsRes.ok) {
        const { collections: cols } = await collectionsRes.json();
        setCollections(cols);
      }
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

  /**
   * Watches whichever transport this breakpoint actually renders and reports
   * when it has scrolled up past the app header. Both anchors are observed:
   * the one belonging to the other breakpoint is `display: none`, which never
   * reports a negative top, so exactly one of them can ever be "passed".
   */
  useEffect(() => {
    const anchors = [mobileTransportRef.current, deskTransportRef.current].filter(
      (el): el is HTMLDivElement => el !== null
    );
    if (anchors.length === 0) return;

    const passed = compactTransportAnchors.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          // isIntersecting alone can't tell "scrolled above" from "still below
          // the fold", and only the former should summon the compact bar.
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            passed.add(entry.target);
          } else {
            passed.delete(entry.target);
          }
        }
        setTransportOffscreen(passed.size > 0);
      },
      { rootMargin: `-${APP_HEADER_HEIGHT_PX}px 0px 0px 0px` }
    );
    for (const anchor of anchors) observer.observe(anchor);

    return () => {
      observer.disconnect();
      passed.clear();
    };
    // The anchors only exist once the scene has rendered, so this has to re-run
    // when it arrives — and again if the user navigates to a different one.
  }, [scene?.id]);

  // Remembers the most recently opened scene so "/" can land back on its mixer view.
  useEffect(() => {
    if (!scene) return;
    const maxAgeSeconds = 60 * 60 * 24 * 365;
    document.cookie = `${LAST_SCENE_COOKIE}=${scene.id}; path=/; max-age=${maxAgeSeconds}; samesite=lax`;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the id needs to re-trigger this; other scene field edits shouldn't rewrite the cookie
  }, [scene?.id]);

  async function loadMusicAudio(
    slotIndex: number,
    audioFileId: string,
    volume: number,
    loop: boolean
  ) {
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
        { volume, loop }
      );
      setMusicLoadState((prev) => ({ ...prev, [slotIndex]: { status: "loaded" } }));
    } catch {
      setMusicLoadState((prev) => ({
        ...prev,
        [slotIndex]: { status: "error", message: `Kunde inte spela upp "${file.filename}"` },
      }));
    }
  }

  async function loadOneshotAudio(
    setId: string,
    slotIndex: number,
    audioFileId: string,
    volume: number,
    loop: boolean
  ) {
    const trackId = oneshotTrackId(setId, slotIndex);
    const file = audioFilesById.get(audioFileId);
    if (!file) {
      setOneshotLoadState((prev) => ({
        ...prev,
        [trackId]: { status: "error", message: "Ljudfilen hittades inte i biblioteket" },
      }));
      return;
    }
    setOneshotLoadState((prev) => ({ ...prev, [trackId]: { status: "loading" } }));
    try {
      await loadOneShotFromUrl(trackId, file.filename, file.playbackUrl, { volume, loop });
      setOneshotLoadState((prev) => ({ ...prev, [trackId]: { status: "loaded" } }));
    } catch {
      setOneshotLoadState((prev) => ({
        ...prev,
        [trackId]: { status: "error", message: `Kunde inte spela upp "${file.filename}"` },
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
          void loadMusicAudio(slot.slotIndex, slot.audioFileId, slot.volume, slot.loop);
        }
      } else if (loadedMusicRef.current[slot.slotIndex]) {
        delete loadedMusicRef.current[slot.slotIndex];
        removeTrack(trackId);
        setMusicLoadState((prev) => ({ ...prev, [slot.slotIndex]: { status: "idle" } }));
      }
    }
    // Only the set on screen is decoded, and what it decodes stays loaded for as
    // long as the scene is: switching back to a set is instant, and a looping
    // pad fired in one set keeps playing while another set is showing.
    for (const slot of activeSet?.slots ?? []) {
      const trackId = oneshotTrackId(slot.setId, slot.slotIndex);
      if (slot.audioFileId) {
        if (loadedOneshotRef.current[trackId] !== slot.audioFileId) {
          loadedOneshotRef.current[trackId] = slot.audioFileId;
          void loadOneshotAudio(
            slot.setId,
            slot.slotIndex,
            slot.audioFileId,
            slot.volume,
            slot.loop
          );
        }
      } else if (loadedOneshotRef.current[trackId]) {
        delete loadedOneshotRef.current[trackId];
        removeOneShotSlot(trackId);
        setOneshotLoadState((prev) => ({ ...prev, [trackId]: { status: "idle" } }));
      }
    }

    // Anything held for a pad the scene no longer has — a deleted set, or a slot
    // reassigned in a set that isn't showing — goes, playing or not. It decodes
    // again from its own set's pass above the next time that set is opened.
    const livePads = new Set(
      scene.oneShotSets.flatMap((set) =>
        set.slots
          .filter((slot) => slot.audioFileId)
          .map((slot) => `${oneshotTrackId(set.id, slot.slotIndex)}:${slot.audioFileId}`)
      )
    );
    for (const [trackId, audioFileId] of Object.entries(loadedOneshotRef.current)) {
      if (livePads.has(`${trackId}:${audioFileId}`)) continue;
      delete loadedOneshotRef.current[trackId];
      removeOneShotSlot(trackId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally re-runs only on scene/active set/audioFilesById changes; engine calls are ref-guarded above
  }, [scene, activeSet?.id, audioFilesById]);

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
    setId: string,
    slotIndex: number,
    body: Record<string, unknown>
  ): Promise<{ ok: boolean; status: number; error?: string }> {
    try {
      const res = await fetch(`/api/scenes/${sceneId}/oneshot-sets/${setId}/slots/${slotIndex}`, {
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

  /**
   * Applies an optimistic edit and, if the server refuses it, puts the old
   * value back and says so. Everything on this desk saves itself as you touch
   * it, which is only trustworthy if a save that didn't happen is visible —
   * silently keeping a value the server rejected is the worst of both.
   */
  function persist(
    run: () => Promise<{ ok: boolean; error?: string }>,
    revert: () => void,
    message: string
  ) {
    void run().then((result) => {
      if (result.ok) return;
      revert();
      notify(result.error ?? message, { tone: "danger" });
    });
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

  /**
   * Clearing a slot throws away its sound, its name and its level in one click,
   * from a menu item sitting a few pixels from "rename". An undo costs one
   * PATCH to put back and spares every correct click the confirm dialog that
   * would otherwise be the alternative.
   */
  async function clearMusicSlot(slotIndex: number) {
    const previous = scene?.musicSlots.find((s) => s.slotIndex === slotIndex);
    setMusicAssigning((prev) => ({ ...prev, [slotIndex]: true }));
    const result = await patchMusicSlot(slotIndex, { audioFileId: null, name: null });
    if (result.ok) {
      setMusicSlotErrors((prev) => ({ ...prev, [slotIndex]: null }));
      if (previous?.audioFileId) {
        notify(`Musikplats ${slotIndex} rensades.`, {
          tone: "info",
          action: {
            label: "Ångra",
            onAction: () =>
              void patchMusicSlot(slotIndex, {
                audioFileId: previous.audioFileId,
                name: previous.name,
                volume: previous.volume,
                loop: previous.loop,
              }),
          },
        });
      }
    }
    setMusicAssigning((prev) => ({ ...prev, [slotIndex]: false }));
  }

  async function assignOneShotSlot(setId: string, slotIndex: number, audioFileId: string) {
    const trackId = oneshotTrackId(setId, slotIndex);
    setOneshotAssigning((prev) => ({ ...prev, [trackId]: true }));
    setOneshotSlotErrors((prev) => ({ ...prev, [trackId]: null }));
    const result = await patchOneShotSlot(setId, slotIndex, { audioFileId, name: null });
    if (!result.ok) {
      if (result.status === 409) {
        setOneshotSlotErrors((prev) => ({
          ...prev,
          [trackId]: "Platsen är redan upptagen av en annan fil.",
        }));
        await fetchAll();
      } else {
        setOneshotSlotErrors((prev) => ({
          ...prev,
          [trackId]: result.error ?? "Kunde inte tilldela platsen",
        }));
      }
    }
    setOneshotAssigning((prev) => ({ ...prev, [trackId]: false }));
  }

  async function clearOneShotSlot(setId: string, slotIndex: number) {
    const trackId = oneshotTrackId(setId, slotIndex);
    const previous = scene ? findOneShotSlot(scene, setId, slotIndex) : undefined;
    setOneshotAssigning((prev) => ({ ...prev, [trackId]: true }));
    const result = await patchOneShotSlot(setId, slotIndex, { audioFileId: null, name: null });
    if (result.ok) {
      setOneshotSlotErrors((prev) => ({ ...prev, [trackId]: null }));
      if (previous?.audioFileId) {
        notify(`One-shot ${slotIndex} rensades.`, {
          tone: "info",
          action: {
            label: "Ångra",
            onAction: () =>
              void patchOneShotSlot(setId, slotIndex, {
                audioFileId: previous.audioFileId,
                name: previous.name,
                volume: previous.volume,
                loop: previous.loop,
              }),
          },
        });
      }
    }
    setOneshotAssigning((prev) => ({ ...prev, [trackId]: false }));
  }

  function handleMusicVolume(slotIndex: number, volume: number) {
    const trackId = musicTrackId(slotIndex);
    const previous = scene?.musicSlots.find((s) => s.slotIndex === slotIndex)?.volume;
    if (tracks[trackId]) setVolume(trackId, volume);
    setScene((prev) =>
      prev
        ? replaceMusicSlot(prev, {
            ...prev.musicSlots.find((s) => s.slotIndex === slotIndex)!,
            volume,
          })
        : prev
    );
    schedulePersist(`music-volume-${slotIndex}`, () =>
      persist(
        () => patchMusicSlot(slotIndex, { volume }),
        () => {
          if (previous === undefined) return;
          // The engine keeps what the user set — yanking a fader back mid-scene
          // would be worse than the mismatch. Only the stored value goes back.
          setScene((prev) =>
            prev
              ? replaceMusicSlot(prev, {
                  ...prev.musicSlots.find((s) => s.slotIndex === slotIndex)!,
                  volume: previous,
                })
              : prev
          );
        },
        `Volymen för musikplats ${slotIndex} kunde inte sparas.`
      )
    );
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
    persist(
      () => patchMusicSlot(slotIndex, { loop }),
      () => {
        if (tracks[trackId]) setLoop(trackId, !loop);
        setScene((prev) =>
          prev
            ? replaceMusicSlot(prev, {
                ...prev.musicSlots.find((s) => s.slotIndex === slotIndex)!,
                loop: !loop,
              })
            : prev
        );
      },
      `Loopinställningen för musikplats ${slotIndex} kunde inte sparas.`
    );
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
    const previous = scene?.musicSlots.find((s) => s.slotIndex === slotIndex)?.name ?? null;
    setScene((prev) =>
      prev
        ? replaceMusicSlot(prev, {
            ...prev.musicSlots.find((s) => s.slotIndex === slotIndex)!,
            name,
          })
        : prev
    );
    persist(
      () => patchMusicSlot(slotIndex, { name }),
      () =>
        setScene((prev) =>
          prev
            ? replaceMusicSlot(prev, {
                ...prev.musicSlots.find((s) => s.slotIndex === slotIndex)!,
                name: previous,
              })
            : prev
        ),
      "Namnet kunde inte sparas."
    );
  }

  function handleMusicMute(slotIndex: number, muted: boolean) {
    setMuted(musicTrackId(slotIndex), muted);
  }

  // The ticked fade length is a property of the scene, not of one button — every
  // way of starting or stopping music honours it, master row and slot alike.
  function startMusic(slotIndex: number) {
    const trackId = musicTrackId(slotIndex);
    if (fadeDurationMs) fadeIn(trackId, fadeDurationMs);
    else play(trackId);
  }

  /**
   * What a slot's own transport button does. Settles on pause, matching the
   * master row: the playhead survives, so pressing play again picks the track
   * up where it was rather than restarting it from the top.
   */
  function pauseMusic(slotIndex: number) {
    const trackId = musicTrackId(slotIndex);
    if (fadeDurationMs) fadeOut(trackId, fadeDurationMs, { then: "pause" });
    else pause(trackId);
  }

  /** The deliberate version, from the slot's menu: silence and rewind. */
  function stopMusic(slotIndex: number) {
    const trackId = musicTrackId(slotIndex);
    if (fadeDurationMs) fadeOut(trackId, fadeDurationMs, { then: "stop" });
    else stop(trackId);
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

  function handleOneShotVolume(setId: string, slotIndex: number, volume: number) {
    const trackId = oneshotTrackId(setId, slotIndex);
    const previous = scene ? findOneShotSlot(scene, setId, slotIndex)?.volume : undefined;
    if (oneShots[trackId]) setOneShotVolume(trackId, volume);
    setScene((prev) => {
      const slot = prev ? findOneShotSlot(prev, setId, slotIndex) : undefined;
      return prev && slot ? replaceOneShotSlot(prev, { ...slot, volume }) : prev;
    });
    schedulePersist(`oneshot-volume-${trackId}`, () =>
      persist(
        () => patchOneShotSlot(setId, slotIndex, { volume }),
        () => {
          if (previous === undefined) return;
          setScene((prev) => {
            const slot = prev ? findOneShotSlot(prev, setId, slotIndex) : undefined;
            return prev && slot ? replaceOneShotSlot(prev, { ...slot, volume: previous }) : prev;
          });
        },
        `Volymen för one-shot ${slotIndex} kunde inte sparas.`
      )
    );
  }

  /**
   * A looping pad plays until it is pressed again. The engine is told first so
   * a sound already in flight starts (or stops) repeating immediately, rather
   * than only from the next press.
   */
  function handleOneShotLoop(setId: string, slotIndex: number, loop: boolean) {
    const trackId = oneshotTrackId(setId, slotIndex);
    if (oneShots[trackId]) setOneShotLoop(trackId, loop);
    setScene((prev) => {
      const slot = prev ? findOneShotSlot(prev, setId, slotIndex) : undefined;
      return prev && slot ? replaceOneShotSlot(prev, { ...slot, loop }) : prev;
    });
    persist(
      () => patchOneShotSlot(setId, slotIndex, { loop }),
      () => {
        if (oneShots[trackId]) setOneShotLoop(trackId, !loop);
        setScene((prev) => {
          const slot = prev ? findOneShotSlot(prev, setId, slotIndex) : undefined;
          return prev && slot ? replaceOneShotSlot(prev, { ...slot, loop: !loop }) : prev;
        });
      },
      `Loopinställningen för one-shot ${slotIndex} kunde inte sparas.`
    );
  }

  async function renameScene(name: string) {
    const previous = scene?.name;
    if (previous === undefined || name === previous) return;
    setScene((prev) => (prev ? { ...prev, name } : prev));
    const res = await fetch(`/api/scenes/${sceneId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    }).catch(() => null);
    if (!res?.ok) setScene((prev) => (prev ? { ...prev, name: previous } : prev));
  }

  /**
   * Back to a neutral desk: silence first, then every fader to its default.
   * Slots already sitting at the default are left alone rather than PATCHed
   * back to the value they already hold.
   */
  function resetAudio() {
    if (!scene) return;

    // Only what the engine actually holds: it throws on an unknown track, and
    // most slots in a scene are empty or not loaded yet.
    for (const slot of scene.musicSlots) {
      const trackId = musicTrackId(slot.slotIndex);
      if (tracks[trackId]) stop(trackId);
    }
    // Every set, not just the one on screen: a looping pad left running in
    // another set is exactly what "Återställ ljud" is for.
    for (const set of scene.oneShotSets) {
      for (const slot of set.slots) {
        const trackId = oneshotTrackId(set.id, slot.slotIndex);
        if (oneShots[trackId]) stopOneShot(trackId);
      }
    }

    setMasterVolume(DEFAULT_BUS_VOLUME);
    for (const groupId of ["left", "right", ONESHOT_GROUP_ID]) {
      setGroupVolume(groupId, DEFAULT_BUS_VOLUME);
    }

    for (const slot of scene.musicSlots) {
      if (slot.volume !== DEFAULT_SLOT_VOLUME) {
        handleMusicVolume(slot.slotIndex, DEFAULT_SLOT_VOLUME);
      }
    }
    for (const set of scene.oneShotSets) {
      for (const slot of set.slots) {
        if (slot.volume !== DEFAULT_SLOT_VOLUME) {
          handleOneShotVolume(set.id, slot.slotIndex, DEFAULT_SLOT_VOLUME);
        }
      }
    }
  }

  async function deleteScene() {
    setDeletingScene(true);
    const res = await fetch(`/api/scenes/${sceneId}`, { method: "DELETE" }).catch(() => null);
    if (!res?.ok) {
      setDeletingScene(false);
      return;
    }
    // "/" checks that the remembered scene still exists, but leaving a pointer
    // to something we just deleted would only cost it a lookup to find out.
    document.cookie = `${LAST_SCENE_COOKIE}=; path=/; max-age=0; samesite=lax`;
    router.push("/scenes");
  }

  function handleOneShotName(setId: string, slotIndex: number, name: string | null) {
    const previous = scene ? (findOneShotSlot(scene, setId, slotIndex)?.name ?? null) : null;
    setScene((prev) => {
      const slot = prev ? findOneShotSlot(prev, setId, slotIndex) : undefined;
      return prev && slot ? replaceOneShotSlot(prev, { ...slot, name }) : prev;
    });
    persist(
      () => patchOneShotSlot(setId, slotIndex, { name }),
      () =>
        setScene((prev) => {
          const slot = prev ? findOneShotSlot(prev, setId, slotIndex) : undefined;
          return prev && slot ? replaceOneShotSlot(prev, { ...slot, name: previous }) : prev;
        }),
      "Namnet kunde inte sparas."
    );
  }

  async function createOneShotSet() {
    if (!scene) return;
    setCreatingSet(true);
    try {
      const res = await fetch(`/api/scenes/${sceneId}/oneshot-sets`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: `Set ${scene.oneShotSets.length + 1}` }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        notify(body?.error ?? "Kunde inte skapa setet", { tone: "danger" });
        return;
      }
      const { set }: { set: OneShotSet } = await res.json();
      setScene((prev) => (prev ? { ...prev, oneShotSets: [...prev.oneShotSets, set] } : prev));
      // A new, empty set is only worth making if you land in it.
      setStoredSetId(set.id);
    } catch {
      notify("Kunde inte skapa setet", { tone: "danger" });
    } finally {
      setCreatingSet(false);
    }
  }

  function renameOneShotSet(setId: string, name: string) {
    const previous = scene?.oneShotSets.find((s) => s.id === setId)?.name;
    if (previous === undefined || name === previous) return;
    const apply = (value: string) =>
      setScene((prev) =>
        prev
          ? {
              ...prev,
              oneShotSets: prev.oneShotSets.map((s) =>
                s.id === setId ? { ...s, name: value } : s
              ),
            }
          : prev
      );
    apply(name);
    persist(
      async () => {
        const res = await fetch(`/api/scenes/${sceneId}/oneshot-sets/${setId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name }),
        }).catch(() => null);
        return { ok: res?.ok ?? false };
      },
      () => apply(previous),
      "Namnet på setet kunde inte sparas."
    );
  }

  /**
   * Deleting a set throws away up to twenty assignments at once, so unlike a
   * single pad this one asks first — there is no undo that could put the whole
   * bank back.
   */
  async function deleteOneShotSet(setId: string) {
    if (!scene) return;
    const set = scene.oneShotSets.find((s) => s.id === setId);
    if (!set) return;
    const filled = set.slots.filter((slot) => slot.audioFileId).length;
    const confirmed = window.confirm(
      filled > 0
        ? `Radera "${set.name}" med ${filled} ljud?`
        : `Radera "${set.name}"?`
    );
    if (!confirmed) return;

    const res = await fetch(`/api/scenes/${sceneId}/oneshot-sets/${setId}`, {
      method: "DELETE",
    }).catch(() => null);
    if (!res?.ok) {
      const body = await res?.json().catch(() => null);
      notify(body?.error ?? "Kunde inte radera setet", { tone: "danger" });
      return;
    }
    setScene((prev) =>
      prev ? { ...prev, oneShotSets: prev.oneShotSets.filter((s) => s.id !== setId) } : prev
    );
    if (storedSetId === setId) setStoredSetId(null);
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
  const transportStatus =
    loadedMusicTrackIds.length === 0 ? "Inga spår laddade" : anyMusicPlaying ? "Spelar" : "Pausad";

  const activeSetSlots = activeSet?.slots ?? [];
  const filledOneShots = activeSetSlots.filter((s) => s.audioFileId);
  const firstFreeOneShot = activeSetSlots.find((s) => !s.audioFileId);
  // Collapsed, the grid shows what is filled plus one way in — twenty dashed
  // rectangles is a lot of nothing to look at on a scene with three sounds.
  const visibleOneShots = showEmptyPads
    ? activeSetSlots
    : [...filledOneShots, ...(firstFreeOneShot ? [firstFreeOneShot] : [])];
  // Named for what they are rather than where they sit: below `sm` the two
  // columns stack, at which point "the left one" is describing nothing.
  const musicColumns = [
    {
      id: "left",
      label: "Musikbuss A",
      slots: scene.musicSlots.slice(0, MUSIC_COLUMN_SIZE),
    },
    { id: "right", label: "Musikbuss B", slots: scene.musicSlots.slice(MUSIC_COLUMN_SIZE) },
  ];

  function renderMusicColumn(column: { id: string; label: string; slots: MusicSlot[] }) {
    const allLooping = column.slots.length > 0 && column.slots.every((s) => s.loop);
    const busVolume = groups[column.id]?.volume ?? 1;
    const isCollapsed = collapsedColumns[column.id] ?? false;

    return (
      <div key={column.id} className="flex min-w-0 flex-col gap-3">
        <div className="flex items-center gap-2 px-1">
          <h3 className="sr-only">{column.label}</h3>
          <SpeakerOnIcon className="h-3.5 w-3.5 flex-none text-muted-foreground" />
          <VolumeSlider
            value={busVolume}
            onChange={(v) => setGroupVolume(column.id, v)}
            className="w-full"
            aria-label={`Bussvolym för ${column.label}`}
          />
          <Tooltip label={allLooping ? "Loop på" : "Loop av"} align="end" className="flex-none">
            <button
              type="button"
              onClick={() => toggleColumnLoop(column.slots.map((s) => s.slotIndex))}
              aria-pressed={allLooping}
              aria-label={
                allLooping
                  ? `Stäng av loop för ${column.label}`
                  : `Loopa ${column.label}`
              }
              className={`focus-ring flex h-7 w-7 flex-none items-center justify-center rounded-md transition ${
                allLooping
                  ? "text-ember-300"
                  : "text-muted-foreground hover:text-ember-300"
              }`}
            >
              <LoopIcon className="h-4 w-4" />
            </button>
          </Tooltip>
          <Tooltip label={isCollapsed ? "Visa kolumn" : "Dölj kolumn"} align="end" className="flex-none">
            <button
              type="button"
              onClick={() =>
                setCollapsedColumns((prev) => ({ ...prev, [column.id]: !isCollapsed }))
              }
              aria-expanded={!isCollapsed}
              aria-label={isCollapsed ? `Visa ${column.label}` : `Dölj ${column.label}`}
              className="focus-ring flex h-7 w-7 flex-none items-center justify-center rounded-md text-muted-foreground transition hover:text-parchment-100"
            >
              <ChevronDownIcon className={`h-4 w-4 transition ${isCollapsed ? "" : "rotate-180"}`} />
            </button>
          </Tooltip>
        </div>

        {!isCollapsed && (
          <div className="flex flex-col gap-3">
            {column.slots.map((slot) => (
              <MusicSlotCard
                key={slot.slotIndex}
                slot={slot}
                file={slot.audioFileId ? (audioFilesById.get(slot.audioFileId) ?? null) : null}
                libraryFiles={musicLibraryFiles}
                collections={collections}
                track={tracks[musicTrackId(slot.slotIndex)]}
                loadState={musicLoadState[slot.slotIndex] ?? { status: "idle" }}
                assigning={musicAssigning[slot.slotIndex] ?? false}
                assignError={musicSlotErrors[slot.slotIndex] ?? null}
                onAssign={(audioFileId) => void assignMusicSlot(slot.slotIndex, audioFileId)}
                onClear={() => void clearMusicSlot(slot.slotIndex)}
                onRetry={() => {
                  if (slot.audioFileId)
                    void loadMusicAudio(slot.slotIndex, slot.audioFileId, slot.volume, slot.loop);
                }}
                onPlay={() => startMusic(slot.slotIndex)}
                onPause={() => pauseMusic(slot.slotIndex)}
                onStop={() => stopMusic(slot.slotIndex)}
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
          <Tooltip label="Ljudbibliotek" align="end">
            <Link
              href="/library"
              aria-label="Ljudbibliotek"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-muted-foreground transition hover:border-ember-400/40 hover:text-ember-300"
            >
              <LibraryIcon className="h-4 w-4" />
            </Link>
          </Tooltip>

          <Popover
            panelClassName="w-80 max-w-[calc(100vw-2rem)]"
            trigger={({ open, toggle }) => (
              <Tooltip label="Ladda upp ljud" align="end">
                <button
                  type="button"
                  onClick={toggle}
                  aria-expanded={open}
                  aria-label="Ladda upp ljud"
                  className={`focus-ring flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                    open
                      ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                      : "border-border-strong text-muted-foreground hover:border-ember-400/40 hover:text-ember-300"
                  }`}
                >
                  <UploadIcon className="h-4 w-4" />
                </button>
              </Tooltip>
            )}
          >
            <AudioUploader
              sceneId={sceneId}
              oneShotSetId={activeSet?.id}
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
            sceneName={scene.name}
            onRenameScene={(name) => void renameScene(name)}
            onResetAudio={resetAudio}
            onDeleteScene={() => void deleteScene()}
            deletingScene={deletingScene}
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

      {/* Below the artwork breakpoint the master controls need a home of their own,
          since the centre column (and its orb) only exists from lg up. */}
      <div
        ref={mobileTransportRef}
        className="mt-5 flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2 lg:hidden"
      >
        <Tooltip
          label={anyMusicPlaying ? "Pausa all musik" : "Spela all musik"}
          className="flex-none"
        >
          <button
            type="button"
            onClick={toggleMasterPlayback}
            disabled={loadedMusicTrackIds.length === 0}
            aria-label={anyMusicPlaying ? "Pausa all musik" : "Spela all musik"}
            className="focus-ring flex h-10 w-10 flex-none items-center justify-center rounded-full bg-gradient-to-b from-ember-400 to-ember-500 text-ink-950 shadow-glow-sm transition hover:shadow-glow disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
          >
            {anyMusicPlaying ? (
              <PauseIcon className="h-4 w-4" />
            ) : (
              <PlayIcon className="h-4 w-4 translate-x-0.5" />
            )}
          </button>
        </Tooltip>
        <span className="flex-none text-xs text-muted-foreground">{transportStatus}</span>
        <SpeakerOnIcon className="ml-auto h-3.5 w-3.5 flex-none text-muted-foreground" />
        <VolumeSlider
          value={masterVolume}
          onChange={setMasterVolume}
          className="w-full max-w-[14rem]"
          aria-label="Mastervolym"
        />
      </div>

      {/* The desk is taller than any screen it runs on, and the master transport
          lives at the top of it — so once it scrolls away, a compact stand-in
          takes over rather than leaving the one-shots with no way to stop the
          music. Fixed under the app header, which owns the top 56px. */}
      <div
        aria-hidden={!transportOffscreen}
        inert={!transportOffscreen}
        className={`fixed inset-x-0 top-14 z-30 px-4 transition-opacity duration-200 sm:px-6 ${
          transportOffscreen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="mx-auto flex w-full max-w-[100rem] items-center gap-3 rounded-xl border border-border bg-surface/95 px-3 py-2 shadow-lg backdrop-blur">
          <Tooltip
            label={anyMusicPlaying ? "Pausa all musik" : "Spela all musik"}
            placement="bottom"
            align="start"
            className="flex-none"
          >
            <button
              type="button"
              onClick={toggleMasterPlayback}
              disabled={loadedMusicTrackIds.length === 0}
              aria-label={anyMusicPlaying ? "Pausa all musik" : "Spela all musik"}
              className="focus-ring flex h-9 w-9 flex-none items-center justify-center rounded-full bg-gradient-to-b from-ember-400 to-ember-500 text-ink-950 shadow-glow-sm transition hover:shadow-glow disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
            >
              {anyMusicPlaying ? (
                <PauseIcon className="h-4 w-4" />
              ) : (
                <PlayIcon className="h-4 w-4 translate-x-0.5" />
              )}
            </button>
          </Tooltip>
          <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
            <span className="text-parchment-200">{scene.name}</span>
            <span className="mx-1.5">·</span>
            {transportStatus}
          </span>
          <SpeakerOnIcon className="h-3.5 w-3.5 flex-none text-muted-foreground" />
          <VolumeSlider
            value={masterVolume}
            onChange={setMasterVolume}
            className="w-full max-w-[10rem] flex-none"
            aria-label="Mastervolym"
          />
        </div>
      </div>

      {/* Two slot columns from tablet width up (iPad portrait is 768–834px). The
          centre column is desktop-only: on a tablet that width is worth more to
          the slots than to the artwork. */}
      {/* The music half of the desk carries no visible heading — the two bus
          faders are self-evident on screen — but without one there is no way
          to find it, or tell it from the one-shots, by structure alone. */}
      <h2 className="sr-only">Musik</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,16rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,1fr)_minmax(0,20rem)_minmax(0,1fr)]">
        {renderMusicColumn(musicColumns[0])}

        <div className="hidden flex-col items-center gap-4 lg:flex">
          <div className="flex w-full items-center gap-2 px-1">
            <SpeakerOnIcon className="h-3.5 w-3.5 flex-none text-muted-foreground" />
            <VolumeSlider
              value={masterVolume}
              onChange={setMasterVolume}
              className="w-full"
              aria-label="Mastervolym"
            />
          </div>

          <SceneArtwork sceneId={scene.id} active={anyMusicPlaying} className="max-w-[18rem]" />

          <div className="flex flex-col items-center gap-2">
            <Tooltip label={anyMusicPlaying ? "Pausa all musik" : "Spela all musik"}>
              <button
                type="button"
                onClick={toggleMasterPlayback}
                disabled={loadedMusicTrackIds.length === 0}
                aria-label={anyMusicPlaying ? "Pausa all musik" : "Spela all musik"}
                className="focus-ring flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-b from-ember-400 to-ember-500 text-ink-950 shadow-glow-sm transition hover:shadow-glow disabled:cursor-not-allowed disabled:from-ink-700 disabled:to-ink-700 disabled:text-parchment-500/50 disabled:shadow-none"
              >
                {anyMusicPlaying ? (
                  <PauseIcon className="h-5 w-5" />
                ) : (
                  <PlayIcon className="h-5 w-5 translate-x-0.5" />
                )}
              </button>
            </Tooltip>
            <p className="text-xs text-muted-foreground">{transportStatus}</p>
          </div>
          <div ref={deskTransportRef} aria-hidden="true" />
        </div>

        {renderMusicColumn(musicColumns[1])}
      </div>

      <section className="mt-10 border-t border-border pt-5">
        <div className="flex flex-wrap items-center gap-4">
          <h2 className="flex-none font-display text-lg font-medium tracking-wide text-parchment-100">
            One-shots
          </h2>
          <span className="flex-none font-mono text-xs text-muted-foreground">
            {filledOneShots.length}/{activeSetSlots.length}
          </span>

          <div className="flex min-w-0 flex-1 items-center justify-center gap-2 sm:max-w-xs">
            <SpeakerOnIcon className="h-3.5 w-3.5 flex-none text-muted-foreground" />
            <VolumeSlider
              value={oneShotBusVolume}
              onChange={(v) => setGroupVolume(ONESHOT_GROUP_ID, v)}
              className="w-full"
              aria-label="Volym för alla one-shots"
            />
          </div>

          <div className="flex flex-none items-center gap-2">
            {/* Always offered, even on an empty scene: with the grid collapsed
                to a single "+" there has to be a visible way to see the rest. */}
            <button
              type="button"
              onClick={() => setShowEmptyPads(!showEmptyPads)}
              aria-pressed={showEmptyPads}
              className="focus-ring rounded-md px-2 py-1 text-xs text-muted-foreground transition hover:text-ember-300"
            >
              {showEmptyPads ? "Dölj tomma platser" : "Visa alla platser"}
            </button>
            <Tooltip label="Ljudbibliotek" align="end">
              <Link
                href="/library"
                aria-label="Ljudbibliotek"
                className="focus-ring flex h-9 w-9 items-center justify-center rounded-lg border border-border-strong text-muted-foreground transition hover:border-ember-400/40 hover:text-ember-300"
              >
                <LibraryIcon className="h-4 w-4" />
              </Link>
            </Tooltip>
            <Popover
              panelClassName="w-80 max-w-[calc(100vw-2rem)]"
              trigger={({ open, toggle }) => (
                <Tooltip label="Ladda upp one-shot" align="end">
                  <button
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    aria-label="Ladda upp one-shot"
                    className={`focus-ring flex h-9 w-9 items-center justify-center rounded-lg border transition ${
                      open
                        ? "border-ember-400/60 bg-ember-400/10 text-ember-300"
                        : "border-border-strong text-muted-foreground hover:border-ember-400/40 hover:text-ember-300"
                    }`}
                  >
                    <UploadIcon className="h-4 w-4" />
                  </button>
                </Tooltip>
              )}
            >
              <AudioUploader
                category="oneshot"
                sceneId={sceneId}
                oneShotSetId={activeSet?.id}
                onUploaded={() => void fetchAll()}
                onAssigned={() => void fetchAll()}
              />
            </Popover>
          </div>
        </div>

        {activeSet && (
          <div className="mt-4 flex items-center gap-2">
            <OneShotSetTabs
              sets={scene.oneShotSets}
              activeSetId={activeSet.id}
              onSelect={setStoredSetId}
              onCreate={() => void createOneShotSet()}
              onRename={renameOneShotSet}
              onDelete={(setId) => void deleteOneShotSet(setId)}
              creating={creatingSet}
            />
          </div>
        )}

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-10">
          {visibleOneShots.map((slot) => {
            const trackId = oneshotTrackId(slot.setId, slot.slotIndex);
            return (
              <OneShotPad
                key={trackId}
                slot={slot}
                file={slot.audioFileId ? (audioFilesById.get(slot.audioFileId) ?? null) : null}
                libraryFiles={oneshotLibraryFiles}
                collections={collections}
                oneShot={oneShots[trackId]}
                loadState={oneshotLoadState[trackId] ?? { status: "idle" }}
                assigning={oneshotAssigning[trackId] ?? false}
                assignError={oneshotSlotErrors[trackId] ?? null}
                onAssign={(audioFileId) =>
                  void assignOneShotSlot(slot.setId, slot.slotIndex, audioFileId)
                }
                onClear={() => void clearOneShotSlot(slot.setId, slot.slotIndex)}
                onRetry={() => {
                  if (slot.audioFileId)
                    void loadOneshotAudio(
                      slot.setId,
                      slot.slotIndex,
                      slot.audioFileId,
                      slot.volume,
                      slot.loop
                    );
                }}
                onTrigger={() => triggerOneShot(trackId)}
                onStop={() => stopOneShot(trackId)}
                onVolumeChange={(volume) =>
                  handleOneShotVolume(slot.setId, slot.slotIndex, volume)
                }
                onLoopChange={(loop) => handleOneShotLoop(slot.setId, slot.slotIndex, loop)}
                onRename={(name) => handleOneShotName(slot.setId, slot.slotIndex, name)}
              />
            );
          })}
        </div>
      </section>

      <NoticeBar notice={notice} onDismiss={dismiss} />
    </div>
  );
}
