"use client";

import { artworkPalette } from "@/lib/artwork";

type CollectionArtworkProps = {
  /** Seeds the tint and layout — same seed always renders the same artwork. */
  seed: string;
  /** Lifts the whole thing while the card behind it is hovered/active. */
  active?: boolean;
  className?: string;
};

/**
 * Decorative cover art for a category or collection. Nothing in the data model
 * holds an image, so the card art is generated from the row's id: deterministic
 * per collection, distinct between collections, and always inside the app's
 * palette. Purely presentational — text is drawn by the card, not by this.
 */
export function CollectionArtwork({ seed, active, className }: CollectionArtworkProps) {
  const { primaryHue, secondaryHue, blobA, blobB, tilt } = artworkPalette(seed);

  return (
    <div
      aria-hidden="true"
      className={`absolute inset-0 overflow-hidden bg-ink-950 ${className ?? ""}`}
    >
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(155deg, hsl(${primaryHue} 42% 16%), var(--color-ink-950) 72%)`,
        }}
      />
      <div
        className={`absolute inset-0 blur-2xl transition-opacity duration-500 ${
          active ? "opacity-95" : "opacity-70"
        }`}
        style={{
          background: `radial-gradient(45% 60% at ${blobA.x * 100}% ${blobA.y * 100}%, hsl(${primaryHue} 72% 52% / 55%), transparent 70%),
            radial-gradient(38% 50% at ${blobB.x * 100}% ${blobB.y * 100}%, hsl(${secondaryHue} 64% 46% / 45%), transparent 72%)`,
        }}
      />
      {/* A single lit streak keeps the blobs from reading as a plain blur. */}
      <div
        className="absolute inset-x-[-20%] top-[58%] h-px opacity-50"
        style={{
          transform: `rotate(${tilt}deg)`,
          background: `linear-gradient(90deg, transparent, hsl(${primaryHue} 80% 70% / 60%), transparent)`,
        }}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(120% 90% at 50% 110%, rgb(9 10 16 / 85%), transparent 60%), radial-gradient(90% 70% at 50% -20%, rgb(9 10 16 / 35%), transparent 60%)",
        }}
      />
    </div>
  );
}
