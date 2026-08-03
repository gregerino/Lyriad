/** Stable-per-string seeding for the app's generated artwork. */
export function hashSeed(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (hash << 5) - hash + value.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

/**
 * Hues the generated artwork is allowed to pick from. Kept to a curated set
 * rather than the full circle so every card still reads as part of the same
 * dark-fantasy palette — ember first, then the cooler and deeper accents.
 */
const ARTWORK_HUES = [24, 38, 8, 344, 268, 218, 190, 148];

export type ArtworkPalette = {
  /** Dominant hue, drives the base wash and the larger blob. */
  primaryHue: number;
  /** Secondary hue for the smaller blob — never the same as the primary. */
  secondaryHue: number;
  /** 0–1 positions for the two blobs, so no two cards light up identically. */
  blobA: { x: number; y: number };
  blobB: { x: number; y: number };
  /** Tilt of the horizon streak, in degrees. */
  tilt: number;
};

export function artworkPalette(seed: string): ArtworkPalette {
  const hash = hashSeed(seed);
  const primaryIndex = hash % ARTWORK_HUES.length;
  // +1 offset guarantees a different entry, so the two blobs always contrast.
  const secondaryIndex = (primaryIndex + 1 + ((hash >> 5) % (ARTWORK_HUES.length - 1))) %
    ARTWORK_HUES.length;

  return {
    primaryHue: ARTWORK_HUES[primaryIndex]!,
    secondaryHue: ARTWORK_HUES[secondaryIndex]!,
    blobA: { x: 0.18 + ((hash >> 3) % 40) / 100, y: 0.2 + ((hash >> 7) % 35) / 100 },
    blobB: { x: 0.55 + ((hash >> 11) % 35) / 100, y: 0.45 + ((hash >> 13) % 40) / 100 },
    tilt: -14 + ((hash >> 17) % 28),
  };
}
