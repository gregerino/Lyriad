"use client";

// TEMPORARY: see src/audio-engine/audioDebug.ts. Renders nothing unless the
// address carries ?debug=audio.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
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

type Variant = {
  label: string;
  setup: (element: HTMLAudioElement) => void;
};

// One setting changed at a time from what the engine does for a music track,
// to find the one that makes the iPad lose the length once playback starts.
const VARIANTS: Variant[] = [
  {
    label: "A som appen",
    setup: (e) => {
      e.preload = "auto";
      e.loop = true;
    },
  },
  {
    label: "B utan loop",
    setup: (e) => {
      e.preload = "auto";
      e.loop = false;
    },
  },
  {
    label: "C metadata",
    setup: (e) => {
      e.preload = "metadata";
      e.loop = false;
    },
  },
  {
    label: "D i DOM",
    setup: (e) => {
      e.preload = "auto";
      e.loop = false;
      document.body.append(e);
    },
  },
  {
    label: "E ljudlös",
    setup: (e) => {
      e.preload = "auto";
      e.loop = false;
      e.muted = true;
    },
  },
];

/**
 * Plays `src` for five seconds in a fresh element and reports what it said.
 * play() is called synchronously so it still counts as the tap's own gesture.
 */
function runVariant(
  variant: Variant,
  src: string,
  report: (line: string) => void,
): void {
  const element = new Audio();
  variant.setup(element);
  const durations: string[] = [];
  let seeks = 0;
  element.addEventListener("durationchange", () => {
    if (durations.length < 5) durations.push(formatNumber(element.duration));
  });
  element.addEventListener("seeking", () => seeks++);
  element.src = src;
  element
    .play()
    .catch((err: Error) =>
      report(`${variant.label}: play refused (${err.name})`),
    );
  setTimeout(() => {
    report(
      `${variant.label}: d=${formatNumber(element.duration)} ct=${formatNumber(element.currentTime)} ` +
        `ended=${element.ended} paused=${element.paused} seeks=${seeks} dc=[${durations.join(", ")}]`,
    );
    element.pause();
    element.removeAttribute("src");
    element.load();
    element.remove();
  }, 5000);
}

export function AudioDebugPanel() {
  // False on the server, so the first client render matches it.
  const enabled = useSyncExternalStore(
    subscribeNever,
    isAudioDebugEnabled,
    () => false,
  );
  const [, setTick] = useState(0);
  const [pointerLog, setPointerLog] = useState<string[]>([]);
  const [variantLog, setVariantLog] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

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
    <div
      ref={panelRef}
      className="fixed inset-x-2 bottom-2 z-[100] max-h-[60vh] overflow-auto rounded-md border border-border-strong bg-black/90 p-2 font-mono text-[10px] leading-tight text-green-300"
    >
      <button
        type="button"
        className="mb-1 rounded border border-white/40 px-2 py-1 text-white"
        onClick={() => {
          const text = panelRef.current?.innerText ?? "";
          void navigator.clipboard.writeText(text).then(() => setCopied(true));
        }}
      >
        {copied ? "Kopierat" : "Kopiera allt"}
      </button>
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
        Test (pausa scenen först, tryck en knapp i taget, vänta 5 s)
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        {VARIANTS.map((variant) => (
          <button
            key={variant.label}
            type="button"
            className="rounded border border-white/40 px-2 py-1 text-white"
            onClick={() => {
              const src = getDebugEntries()[0]?.[1].element.currentSrc;
              if (!src) return;
              runVariant(variant, src, (line) =>
                setVariantLog((log) => [...log, line]),
              );
            }}
          >
            {variant.label}
          </button>
        ))}
      </div>
      <div className="text-yellow-200">
        {variantLog.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      <div className="mt-2 border-t border-white/20 pt-1 text-white">
        Slider events
      </div>
      <div className="text-white/60">
        {pointerLog.join(" · ") || "none yet"}
      </div>
    </div>
  );
}
