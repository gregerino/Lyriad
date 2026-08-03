"use client";

import { hashSeed } from "@/lib/artwork";

type SceneArtworkProps = {
  /** Seeds the shape/tint so two scenes don't look identical. */
  sceneId: string;
  /** Playing scenes get a livelier glow. */
  active?: boolean;
  className?: string;
};

/**
 * Decorative placeholder for the scene's centrepiece — no artwork exists in the
 * data model yet, so this is generated from the scene id: same scene always
 * renders the same orb, different scenes differ. Purely presentational.
 */
export function SceneArtwork({ sceneId, active, className }: SceneArtworkProps) {
  const seed = hashSeed(sceneId);
  const tilt = seed % 360;
  const blobX = 38 + (seed % 24);
  const blobY = 34 + ((seed >> 3) % 26);
  const gradientId = `orb-core-${seed}`;
  const shellId = `orb-shell-${seed}`;

  return (
    <div className={`relative aspect-square w-full ${className ?? ""}`} aria-hidden="true">
      <div
        className={`absolute inset-[12%] rounded-full blur-3xl transition-opacity duration-1000 ${
          active ? "opacity-60" : "opacity-25"
        }`}
        style={{
          background:
            "radial-gradient(circle at 50% 45%, var(--color-ember-400), transparent 65%)",
        }}
      />
      <svg viewBox="0 0 200 200" className="relative h-full w-full">
        <defs>
          <radialGradient id={shellId} cx="50%" cy="42%" r="62%">
            <stop offset="0%" stopColor="var(--color-ink-700)" />
            <stop offset="70%" stopColor="var(--color-ink-900)" />
            <stop offset="100%" stopColor="var(--color-ink-950)" />
          </radialGradient>
          <radialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--color-ember-200)" stopOpacity="0.95" />
            <stop offset="45%" stopColor="var(--color-ember-500)" stopOpacity="0.55" />
            <stop offset="100%" stopColor="var(--color-ember-700)" stopOpacity="0" />
          </radialGradient>
        </defs>

        <circle cx="100" cy="100" r="96" fill={`url(#${shellId})`} />
        <g transform={`rotate(${tilt} 100 100)`}>
          <ellipse cx={blobX + 40} cy={blobY + 40} rx="52" ry="38" fill={`url(#${gradientId})`} />
          <ellipse
            cx={140 - blobX / 2}
            cy={150 - blobY / 3}
            rx="34"
            ry="26"
            fill={`url(#${gradientId})`}
            opacity="0.5"
          />
        </g>
        <circle
          cx="100"
          cy="100"
          r="95"
          fill="none"
          stroke="var(--color-ink-700)"
          strokeWidth="1"
        />
      </svg>
    </div>
  );
}
