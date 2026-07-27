"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

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
      {trigger({ open, toggle: () => setOpen((v) => !v) })}
      {open && (
        <div
          className={`absolute z-40 mt-2 rounded-lg border border-border-strong bg-surface-elevated p-3 shadow-lg ${
            align === "right" ? "right-0" : "left-0"
          } ${panelClassName ?? ""}`}
        >
          {typeof children === "function" ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}
