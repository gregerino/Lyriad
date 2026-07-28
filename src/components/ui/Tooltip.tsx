"use client";

import type { ReactNode } from "react";

type TooltipProps = {
  /** The words an icon-only control can't say for itself. */
  label: string;
  children: ReactNode;
  /** Flips the bubble below the trigger where there is no room above it. */
  placement?: "top" | "bottom";
  /**
   * Which edge the bubble lines up with. Centred reads best, but a trigger
   * sitting against the edge of the window needs its bubble pulled inwards —
   * there is no CSS that clamps to the viewport, and measuring every tooltip
   * on mount to find out costs more than picking the side by hand.
   */
  align?: "center" | "start" | "end";
  /**
   * Lands on the wrapper, which takes the trigger's place in the parent
   * layout — pass whatever flex sizing the trigger used to carry itself.
   */
  className?: string;
};

/**
 * A hover/focus label for icon-only buttons. Purely presentational: every
 * trigger already carries its own `aria-label`, so the bubble is hidden from
 * assistive tech rather than read out a second time.
 *
 * CSS-only on purpose — no timers, no state, nothing to leak if the trigger
 * unmounts mid-hover, which happens all over this UI as menus open and close.
 */
const ALIGNMENT = {
  center: "left-1/2 -translate-x-1/2",
  start: "left-0",
  end: "right-0",
} as const;

export function Tooltip({
  label,
  children,
  placement = "top",
  align = "center",
  className,
}: TooltipProps) {
  return (
    <span className={`group/tip relative inline-flex ${className ?? ""}`}>
      {children}
      <span
        aria-hidden="true"
        className={`pointer-events-none absolute z-50 whitespace-nowrap rounded-md border border-border-strong bg-surface-elevated px-2 py-1 text-[11px] font-medium text-parchment-100 opacity-0 shadow-md transition-opacity duration-100 group-hover/tip:opacity-100 group-hover/tip:delay-300 group-has-[:focus-visible]/tip:opacity-100 ${
          ALIGNMENT[align]
        } ${placement === "top" ? "bottom-full mb-1.5" : "top-full mt-1.5"}`}
      >
        {label}
      </span>
    </span>
  );
}
