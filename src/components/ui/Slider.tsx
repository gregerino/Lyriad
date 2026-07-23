"use client";

import type { CSSProperties } from "react";

type SliderProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  className?: string;
  "aria-label"?: string;
};

export function Slider({ value, onChange, disabled, className, ...aria }: SliderProps) {
  return (
    <input
      type="range"
      min={0}
      max={1}
      step={0.01}
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(Number(e.target.value))}
      className={`lyriad-slider ${className ?? ""}`}
      style={{ "--slider-fill": `${Math.round(value * 100)}%` } as CSSProperties}
      {...aria}
    />
  );
}
