import type { AudioEngine } from "./AudioEngine";

/**
 * A scene left with music still playing. Leaving a scene mid-session must not
 * drop the table into silence: the music carries on until the next scene
 * starts music of its own, and fades out under it then.
 */
export type LingeringScene = {
  sceneId: string;
  sceneName: string;
  engine: AudioEngine;
};

/**
 * Used when nothing else says how long to take: the old music has to go, and a
 * hard cut sounds like a crash rather than a change.
 */
export const HANDOFF_FALLBACK_FADE_MS = 400;

let lingering: LingeringScene | null = null;
const listeners = new Set<() => void>();

function set(next: LingeringScene | null): void {
  lingering = next;
  for (const listener of listeners) listener();
}

export function getLingeringScene(): LingeringScene | null {
  return lingering;
}

export function subscribeLingeringScene(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Keeps `engine` playing after its scene unmounts. There is only ever one
 * lingering scene; one already waiting is faded out to make room.
 */
export function handOffScene(sceneId: string, sceneName: string, engine: AudioEngine): void {
  const previous = lingering;
  if (previous?.engine !== engine) previous?.engine.disposeWithFade(HANDOFF_FALLBACK_FADE_MS);
  set({ sceneId, sceneName, engine });
}

/** The engine a scene left behind, if `sceneId` is that scene — for taking it back over. */
export function peekLingeringEngine(sceneId: string): AudioEngine | null {
  return lingering?.sceneId === sceneId ? lingering.engine : null;
}

/** The scene has its engine back; it is no longer lingering. */
export function reclaimScene(engine: AudioEngine): void {
  if (lingering?.engine === engine) set(null);
}

/** Fades the lingering scene's music out over `durationMs` and lets it go. */
export function fadeOutLingeringScene(durationMs: number): void {
  if (!lingering) return;
  const { engine } = lingering;
  set(null);
  engine.disposeWithFade(Math.max(durationMs, HANDOFF_FALLBACK_FADE_MS));
}
