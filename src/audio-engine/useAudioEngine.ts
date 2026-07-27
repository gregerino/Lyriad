"use client";

import { useCallback, useEffect, useState } from "react";
import { AudioEngine, type EngineState, type FadeCurve } from "./AudioEngine";

const EMPTY_STATE: EngineState = { tracks: {}, oneShots: {}, masterVolume: 1, groups: {} };

export function useAudioEngine() {
  const [engine] = useState(() => new AudioEngine());
  const [state, setState] = useState<EngineState>(EMPTY_STATE);

  useEffect(() => {
    const unsubscribe = engine.subscribe(setState);
    return () => {
      unsubscribe();
      engine.dispose();
    };
  }, [engine]);

  const loadTrack = useCallback(
    async (id: string, file: File, groupId: string, initialVolume?: number) => {
      const data = await file.arrayBuffer();
      await engine.loadTrack(id, file.name, data, groupId, initialVolume);
    },
    [engine],
  );

  const loadTrackFromUrl = useCallback(
    async (id: string, name: string, url: string, groupId: string, initialVolume?: number) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Kunde inte hämta ljudfilen (${res.status})`);
      const data = await res.arrayBuffer();
      await engine.loadTrack(id, name, data, groupId, initialVolume);
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
    async (id: string, file: File, initialVolume?: number) => {
      const data = await file.arrayBuffer();
      await engine.loadOneShot(id, file.name, data, initialVolume);
    },
    [engine],
  );

  const loadOneShotFromUrl = useCallback(
    async (id: string, name: string, url: string, initialVolume?: number) => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Kunde inte hämta ljudfilen (${res.status})`);
      const data = await res.arrayBuffer();
      await engine.loadOneShot(id, name, data, initialVolume);
    },
    [engine],
  );
  const triggerOneShot = useCallback((id: string) => engine.triggerOneShot(id), [engine]);
  const stopOneShot = useCallback((id: string) => engine.stopOneShot(id), [engine]);
  const setOneShotVolume = useCallback(
    (id: string, volume: number) => engine.setOneShotVolume(id, volume),
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
    removeOneShotSlot,
  };
}
