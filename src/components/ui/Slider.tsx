"use client";

import type { CSSProperties, KeyboardEvent, PointerEvent } from "react";

type SliderProps = {
  value: number;
  onChange: (value: number) => void;
  /**
   * Fired once when the user lets go (pointer release / key up) rather than on
   * every drag frame — for changes too expensive to apply continuously, like a
   * seek that restarts playback.
   */
  onCommit?: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
  "aria-valuetext"?: string;
};

export function Slider({
  value,
  onChange,
  onCommit,
  min = 0,
  max = 1,
  step = 0.01,
  disabled,
  className,
  ...aria
}: SliderProps) {
  const range = max - min;
  const fill = range > 0 ? Math.min(100, Math.max(0, ((value - min) / range) * 100)) : 0;

  const commit = onCommit
    ? (e: PointerEvent<HTMLInputElement> | KeyboardEvent<HTMLInputElement>) =>
        onCommit(Number(e.currentTarget.value))
    : undefined;

  return (
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      onPointerUp={commit}
      onKeyUp={commit}
      className={`lyriad-slider ${className ?? ""}`}
      style={{ "--slider-fill": `${fill.toFixed(2)}%` } as CSSProperties}
      {...aria}
    />
  );
}
