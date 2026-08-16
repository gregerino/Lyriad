"use client";

import { useCallback, useEffect, useState } from "react";
import { AudioEngine, type EngineState, type FadeCurve } from "./AudioEngine";

const EMPTY_STATE: EngineState = { tracks: {}, oneShots: {}, masterVolume: 1, groups: {} };

/**
 * Long enough to read as a scene ending rather than as a dropout, short enough
 * that leaving a scene still feels immediate.
 */
const TEARDOWN_FADE_MS = 400;

export function useAudioEngine() {
  const [engine] = useState(() => new AudioEngine());
  const [state, setState] = useState<EngineState>(EMPTY_STATE);

  useEffect(() => {
    const unsubscribe = engine.subscribe(setState);
    return () => {
      unsubscribe();
      // Navigating away unmounts the scene, which is the only thing that ends
      // playback wholesale — so it fades out instead of cutting.
      engine.disposeWithFade(TEARDOWN_FADE_MS);
    };
  }, [engine]);

  const loadTrack = useCallback(
    async (
      id: string,
      file: File,
      groupId: string,
      options: { volume?: number; loop?: boolean } = {},
    ) => {
      // Music streams from an object URL rather than being read into memory.
      const objectUrl = URL.createObjectURL(file);
      await engine.loadTrack(id, file.name, objectUrl, groupId, { ...options, objectUrl });
    },
    [engine],
  );

  const loadTrackFromUrl = useCallback(
    async (
      id: string,
      name: string,
      url: string,
      groupId: string,
      options: { volume?: number; loop?: boolean } = {},
    ) => {
      await engine.loadTrack(id, name, url, groupId, options);
    },
    [engine],
  );

  const play = useCallback((id: string) => engine.play(id), [engine]);
  const pause = useCallback((id: string) => engine.pause(id), [engine]);
  const stop = useCallback((id: string) => engine.stop(id), [engine]);
  const seek = useCallback((id: string, positionSeconds: number) => engine.seek(id, positionSeconds), [engine]);
  // Stable identity so components can poll it from an effect without restarting the timer each render.
  const getPosition = useCallback((id: string) => engine.getPosition(id), [engine]);
  const setVolume = useCallback(
    (id: string, volume: number) => engine.setVolume(id, volume),
    [engine],
  );
  const setLoop = useCallback((id: string, loop: boolean) => engine.setLoop(id, loop), [engine]);
  const setMuted = useCallback((id: string, muted: boolean) => engine.setMuted(id, muted), [engine]);
  const removeTrack = useCallback((id: string) => engine.removeTrack(id), [engine]);
  const fadeIn = useCallback(
    (id: string, durationMs: number, options?: { targetVolume?: number; curve?: FadeCurve }) =>
      engine.fadeIn(id, durationMs, options),
    [engine],
  );
  const fadeOut = useCallback(
    (
      id: string,
      durationMs: number,
      options?: { curve?: FadeCurve; then?: "stop" | "pause" | "none" },
    ) => engine.fadeOut(id, durationMs, options),
    [engine],
  );
  const crossfade = useCallback(
    (
      fromId: string,
      toId: string,
      durationMs: number,
      options?: { curve?: FadeCurve; targetVolume?: number },
    ) => engine.crossfade(fromId, toId, durationMs, options),
    [engine],
  );
  const setMasterVolume = useCallback(
    (volume: number) => engine.setMasterVolume(volume),
    [engine],
  );
  const setGroupVolume = useCallback(
    (groupId: string, volume: number) => engine.setGroupVolume(groupId, volume),
    [engine],
  );

  const loadOneShot = useCallback(
    async (id: string, file: File, options: { volume?: number; loop?: boolean } = {}) => {
      // Handed over as a URL rather than an ArrayBuffer so the engine can decide
      // whether this pad is short enough to decode at all — reading a long file
      // into memory here would already have cost what that check is there to save.
      const objectUrl = URL.createObjectURL(file);
      await engine.loadOneShot(id, file.name, objectUrl, { ...options, objectUrl });
    },
    [engine],
  );

  const loadOneShotFromUrl = useCallback(
    async (
      id: string,
      name: string,
      url: string,
      options?: { volume?: number; loop?: boolean },
    ) => {
      await engine.loadOneShot(id, name, url, options);
    },
    [engine],
  );
  const triggerOneShot = useCallback((id: string) => engine.triggerOneShot(id), [engine]);
  const stopOneShot = useCallback((id: string) => engine.stopOneShot(id), [engine]);
  const setOneShotVolume = useCallback(
    (id: string, volume: number) => engine.setOneShotVolume(id, volume),
    [engine],
  );
  const setOneShotLoop = useCallback(
    (id: string, loop: boolean) => engine.setOneShotLoop(id, loop),
    [engine],
  );
  const removeOneShotSlot = useCallback((id: string) => engine.removeOneShotSlot(id), [engine]);

  return {
    tracks: state.tracks,
    oneShots: state.oneShots,
    masterVolume: state.masterVolume,
    groups: state.groups,
    loadTrack,
    loadTrackFromUrl,
    play,
    pause,
    stop,
    seek,
    getPosition,
    setVolume,
    setLoop,
    setMuted,
    removeTrack,
    fadeIn,
    fadeOut,
    crossfade,
    setMasterVolume,
    setGroupVolume,
    loadOneShot,
    loadOneShotFromUrl,
    triggerOneShot,
    stopOneShot,
    setOneShotVolume,
    setOneShotLoop,
    removeOneShotSlot,
  };
}
