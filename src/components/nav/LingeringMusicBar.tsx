"use client";

import { useSyncExternalStore } from "react";
import { fadeOutLingeringScene, getLingeringScene, subscribeLingeringScene } from "@/audio-engine";
import { SpeakerOnIcon } from "@/components/ui/icons";
import { FADE_SETTING_KEY } from "@/lib/fadeSetting";
import { useStoredSetting } from "@/lib/useStoredSetting";

/**
 * Music left playing by a scene the user has moved on from. Its own desk is
 * gone, so this is the one place it can be silenced from — on any page, not
 * just the next scene, since it plays on there too.
 */
export function LingeringMusicBar() {
  const lingering = useSyncExternalStore(
    subscribeLingeringScene,
    getLingeringScene,
    () => null
  );
  const [fadeDurationMs] = useStoredSetting<number | null>(FADE_SETTING_KEY, null);

  if (!lingering) return null;

  return (
    <div className="border-b border-border bg-surface-elevated/60">
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-2 text-sm sm:px-6">
        <SpeakerOnIcon className="h-4 w-4 flex-none text-ember-400" />
        <span className="min-w-0 flex-1 truncate text-parchment-300">
          Fortsätter från <span className="text-parchment-100">{lingering.sceneName}</span>
        </span>
        <button
          type="button"
          onClick={() => fadeOutLingeringScene(fadeDurationMs ?? 0)}
          className="focus-ring flex-none rounded-md px-2.5 py-1 text-ember-400 transition hover:bg-surface-elevated hover:text-ember-300"
        >
          Tona ut
        </button>
      </div>
    </div>
  );
}
