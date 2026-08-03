"use client";

import { Slider } from "@/components/ui/Slider";

type VolumeSliderProps = {
  value: number;
  onChange: (value: number) => void;
  disabled?: boolean;
  /** Sizing for the fader itself — the readout floats and takes no space. */
  className?: string;
  "aria-label": string;
};

/**
 * A fader that says what it is set to, but only while you are setting it. The
 * number rides above the track on `:active` (i.e. mid-drag) and on keyboard
 * focus, then fades back out — a mixer that shows ten percentages at rest is
 * reading as a spreadsheet, and the whole point of the desk is that it doesn't.
 *
 * CSS-only, like Tooltip: no drag state to track, nothing to leak if the slider
 * unmounts mid-drag, which happens whenever a slot is cleared while in use.
 * Absolutely positioned so appearing and disappearing never moves the row.
 */
export function VolumeSlider({
  value,
  onChange,
  disabled,
  className,
  ...aria
}: VolumeSliderProps) {
  return (
    <span className={`group/vol relative inline-flex items-center ${className ?? ""}`}>
      <Slider value={value} onChange={onChange} disabled={disabled} className="w-full" {...aria} />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute bottom-full right-0 z-30 mb-0.5 rounded-md border border-border-strong bg-surface-elevated px-1.5 py-0.5 font-mono text-[11px] text-parchment-100 opacity-0 shadow-md transition-opacity duration-100 group-active/vol:opacity-100 group-has-[:focus-visible]/vol:opacity-100"
      >
        {Math.round(value * 100)}%
      </span>
    </span>
  );
}
