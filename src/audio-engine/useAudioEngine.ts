"use client";

import { useCallback, useEffect, useState } from "react";
import { AudioEngine, type TrackState } from "./AudioEngine";

export function useAudioEngine() {
  const [engine] = useState(() => new AudioEngine());
  const [tracks, setTracks] = useState<Record<string, TrackState>>({});

  useEffect(() => {
    const unsubscribe = engine.subscribe(setTracks);
    return () => {
      unsubscribe();
      engine.dispose();
    };
  }, [engine]);

  const loadTrack = useCallback(
    async (id: string, file: File) => {
      const data = await file.arrayBuffer();
      await engine.loadTrack(id, file.name, data);
    },
    [engine],
  );

  const play = useCallback((id: string) => engine.play(id), [engine]);
  const pause = useCallback((id: string) => engine.pause(id), [engine]);
  const stop = useCallback((id: string) => engine.stop(id), [engine]);
  const setVolume = useCallback(
    (id: string, volume: number) => engine.setVolume(id, volume),
    [engine],
  );
  const setLoop = useCallback((id: string, loop: boolean) => engine.setLoop(id, loop), [engine]);
  const removeTrack = useCallback((id: string) => engine.removeTrack(id), [engine]);

  return { tracks, loadTrack, play, pause, stop, setVolume, setLoop, removeTrack };
}
