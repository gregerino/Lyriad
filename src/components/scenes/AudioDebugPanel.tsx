"use client";

// TEMPORARY: see src/audio-engine/audioDebug.ts. Renders nothing unless the
// address carries ?debug=audio.

import { useEffect, useState, useSyncExternalStore } from "react";
import { mediaDuration } from "@/audio-engine/AudioEngine";
import {
  formatNumber,
  getDebugEntries,
  isAudioDebugEnabled,
} from "@/audio-engine/audioDebug";

function describeRanges(ranges: TimeRanges): string {
  const parts: string[] = [];
  for (let i = 0; i < ranges.length; i++) {
    parts.push(
      `${formatNumber(ranges.start(i))}–${formatNumber(ranges.end(i))}`,
    );
  }
  return parts.length ? parts.join(", ") : "none";
}

const subscribeNever = () => () => {};

export function AudioDebugPanel() {
  // False on the server, so the first client render matches it.
  const enabled = useSyncExternalStore(
    subscribeNever,
    isAudioDebugEnabled,
    () => false,
  );
  const [, setTick] = useState(0);
  const [pointerLog, setPointerLog] = useState<string[]>([]);

  useEffect(() => {
    if (!enabled) return;
    const timer = setInterval(() => setTick((t) => t + 1), 500);

    // What the seek slider actually receives from a finger.
    const types = [
      "pointerdown",
      "pointerup",
      "pointercancel",
      "touchend",
      "change",
    ];
    const onEvent = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (!(target instanceof HTMLInputElement) || target.type !== "range")
        return;
      const label = target.getAttribute("aria-label") ?? "range";
      setPointerLog((log) => [
        ...log.slice(-7),
        `${e.type} on "${label}" value=${target.value}`,
      ]);
    };
    for (const type of types) document.addEventListener(type, onEvent, true);
    return () => {
      clearInterval(timer);
      for (const type of types)
        document.removeEventListener(type, onEvent, true);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="fixed inset-x-2 bottom-2 z-[100] max-h-[60vh] overflow-auto rounded-md border border-border-strong bg-black/90 p-2 font-mono text-[10px] leading-tight text-green-300">
      <div>{navigator.userAgent}</div>
      {getDebugEntries().map(([id, { name, element, events }]) => (
        <div key={id} className="mt-2 border-t border-white/20 pt-1">
          <div className="text-white">
            {id} · {name}
          </div>
          <div>
            duration={formatNumber(element.duration)} engine=
            {formatNumber(mediaDuration(element))} currentTime=
            {formatNumber(element.currentTime)} readyState={element.readyState}{" "}
            networkState=
            {element.networkState} paused={String(element.paused)}
          </div>
          <div>
            seekable={describeRanges(element.seekable)} buffered=
            {describeRanges(element.buffered)}
          </div>
          <div>
            error=
            {element.error
              ? `${element.error.code} ${element.error.message}`
              : "none"}{" "}
            src=
            {element.currentSrc ? new URL(element.currentSrc).host : "none"}
          </div>
          <div className="text-white/60">{events.join(" · ")}</div>
        </div>
      ))}
      <div className="mt-2 border-t border-white/20 pt-1 text-white">
        Slider events
      </div>
      <div className="text-white/60">
        {pointerLog.join(" · ") || "none yet"}
      </div>
    </div>
  );
}
