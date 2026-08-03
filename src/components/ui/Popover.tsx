"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";

/** Breathing room kept between a nudged panel and the edge of the window. */
const VIEWPORT_MARGIN = 8;

type PopoverProps = {
  /** Rendered as the toggle. Gets the open state so it can style itself. */
  trigger: (props: { open: boolean; toggle: () => void }) => ReactNode;
  children: ReactNode | ((props: { close: () => void }) => ReactNode);
  /** Which edge the panel lines up with. */
  align?: "left" | "right";
  className?: string;
  panelClassName?: string;
};

/**
 * Click-outside/Escape dismissable panel anchored to a trigger. Deliberately
 * unstyled beyond the surface itself — callers own the contents.
 */
export function Popover({
  trigger,
  children,
  align = "right",
  className,
  panelClassName,
}: PopoverProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  // A panel anchored to something near the edge of the window — the kebab on the
  // leftmost one-shot pad, say — would otherwise hang off-screen with half its
  // contents unreachable. Nudge it back in. The measurement includes whatever
  // shift is already applied, so the correction converges after one extra pass.
  useLayoutEffect(() => {
    if (!open) return;
    const rect = panelRef.current?.getBoundingClientRect();
    if (!rect) return;
    let delta = 0;
    if (rect.left < VIEWPORT_MARGIN) {
      delta = VIEWPORT_MARGIN - rect.left;
    } else if (rect.right > window.innerWidth - VIEWPORT_MARGIN) {
      delta = Math.max(
        window.innerWidth - VIEWPORT_MARGIN - rect.right,
        VIEWPORT_MARGIN - rect.left
      );
    }
    if (delta !== 0) setShift((current) => current + delta);
  }, [open, shift]);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${className ?? ""}`}>
      {trigger({
        open,
        toggle: () => {
          // Cleared here rather than on close so the next open always measures
          // from the panel's natural position instead of a stale correction.
          setShift(0);
          setOpen((v) => !v);
        },
      })}
      {open && (
        <div
          ref={panelRef}
          style={shift ? { transform: `translateX(${shift}px)` } : undefined}
          // A panel taller than the window has the same problem as one wider
          // than it, and the nudge above only handles the horizontal case — a
          // slot picker opened from the bottom row of the desk would otherwise
          // run its "upload" half off the bottom of the screen with no way to
          // reach it. Panels shorter than this are untouched.
          className={`absolute z-40 mt-2 max-h-[70vh] overflow-y-auto overscroll-contain rounded-lg border border-border-strong bg-surface-elevated p-3 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          } ${panelClassName ?? ""}`}
        >
          {typeof children === "function" ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}
