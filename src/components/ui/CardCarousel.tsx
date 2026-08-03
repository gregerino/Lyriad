"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/ui/icons";

/** Slack allowed before an edge counts as reached, in px. */
const EDGE_TOLERANCE = 8;

type CardCarouselProps = {
  /** Cards, laid out in a row. Each one should carry its own fixed width. */
  children: ReactNode;
  /** Names the scrollable region for screen readers. */
  label: string;
  className?: string;
};

/**
 * A horizontally scrolling row of cards with edge arrows. The row is a plain
 * scroll container — touch and trackpad scroll it directly, which is what an
 * iPad does — and the arrows are an addition for mouse and keyboard, hidden
 * whenever there is nothing left to scroll in that direction.
 */
export function CardCarousel({ children, label, className }: CardCarouselProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(true);

  const syncEdges = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= EDGE_TOLERANCE);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - EDGE_TOLERANCE);
  }, []);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const track = trackRef.current;
    if (!scroller || !track) return;

    scroller.addEventListener("scroll", syncEdges, { passive: true });
    // Observing the track rather than the scroller: the scroller's own box is
    // fixed by the layout, so only the track's width changes when cards load.
    // ResizeObserver fires once on observe, which doubles as the initial read.
    const observer = new ResizeObserver(syncEdges);
    observer.observe(track);
    observer.observe(scroller);

    return () => {
      scroller.removeEventListener("scroll", syncEdges);
      observer.disconnect();
    };
  }, [syncEdges]);

  function scrollByPage(direction: 1 | -1) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: "smooth" });
  }

  return (
    <div className={`group/carousel relative ${className ?? ""}`}>
      <div
        ref={scrollerRef}
        role="group"
        aria-label={label}
        className="no-scrollbar snap-x snap-mandatory overflow-x-auto scroll-smooth"
      >
        <div ref={trackRef} className="flex w-max gap-4 px-0.5 py-0.5">
          {children}
        </div>
      </div>

      {!atStart && (
        <CarouselArrow direction="left" onClick={() => scrollByPage(-1)} label={label} />
      )}
      {!atEnd && (
        <CarouselArrow direction="right" onClick={() => scrollByPage(1)} label={label} />
      )}
    </div>
  );
}

function CarouselArrow({
  direction,
  onClick,
  label,
}: {
  direction: "left" | "right";
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={direction === "left" ? `Bläddra vänster i ${label}` : `Bläddra höger i ${label}`}
      className={`focus-ring absolute top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-border-strong bg-surface/90 text-parchment-200 shadow-md backdrop-blur transition hover:border-ember-400/50 hover:text-ember-300 ${
        direction === "left" ? "left-1" : "right-1"
      }`}
    >
      <ChevronDownIcon
        className={`h-4 w-4 ${direction === "left" ? "rotate-90" : "-rotate-90"}`}
      />
    </button>
  );
}
