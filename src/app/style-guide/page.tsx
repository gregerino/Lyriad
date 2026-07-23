import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Style Guide — Lyriad",
};

const inkScale = [
  ["950", "#090a10"],
  ["900", "#0f1018"],
  ["850", "#14151f"],
  ["800", "#191a26"],
  ["700", "#262838"],
  ["600", "#383b4d"],
  ["500", "#4b4f66"],
  ["400", "#656b85"],
  ["300", "#8a90a8"],
  ["200", "#b6bccd"],
  ["100", "#dbdee7"],
  ["50", "#eef0f5"],
] as const;

const emberScale = [
  ["950", "#2a150d"],
  ["900", "#4a2717"],
  ["800", "#6b371c"],
  ["700", "#8f461d"],
  ["600", "#b85a20"],
  ["500", "#d97128"],
  ["400", "#ec8a3a"],
  ["300", "#f2ab57"],
  ["200", "#f7c988"],
  ["100", "#fbe4bb"],
  ["50", "#fdf3e1"],
] as const;

const parchmentScale = [
  ["700", "#4a4234"],
  ["600", "#675d49"],
  ["500", "#877a61"],
  ["400", "#a99b7d"],
  ["300", "#ccbc99"],
  ["200", "#e2d5b8"],
  ["100", "#f0e7d4"],
  ["50", "#f8f2e6"],
] as const;

const wineScale = [
  ["600", "#742620"],
  ["500", "#92352f"],
  ["400", "#b2544f"],
] as const;

const spacingSteps = [
  ["xs", "0.5rem"],
  ["sm", "0.75rem"],
  ["md", "1.25rem"],
  ["lg", "2rem"],
  ["xl", "3rem"],
  ["2xl", "4.5rem"],
] as const;

const radiusSteps = [
  ["sm", "rounded-sm"],
  ["md", "rounded-md"],
  ["lg", "rounded-lg"],
  ["xl", "rounded-xl"],
  ["2xl", "rounded-2xl"],
] as const;

const shadowSteps = [
  ["xs", "shadow-xs"],
  ["sm", "shadow-sm"],
  ["md", "shadow-md"],
  ["lg", "shadow-lg"],
] as const;

const tags = ["bramblewick_emporium", "medieval_battlefield", "suspense"];

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="font-mono text-xs uppercase tracking-[0.2em] text-ember-400">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mt-2 font-display text-3xl font-medium tracking-wide text-parchment-100">
      {children}
    </h2>
  );
}

function ColorSwatchRow({
  name,
  scale,
}: {
  name: string;
  scale: readonly (readonly [string, string])[];
}) {
  return (
    <div>
      <p className="mb-3 font-display text-lg tracking-wide text-parchment-200">
        {name}
      </p>
      <div className="flex flex-wrap gap-3">
        {scale.map(([step, hex]) => (
          <div key={step} className="w-24">
            <div
              className="h-16 w-full rounded-md border border-white/5 shadow-sm"
              style={{ background: hex }}
            />
            <p className="mt-1.5 text-xs text-parchment-300">
              {name}-{step}
            </p>
            <p className="font-mono text-[11px] text-muted-foreground">{hex}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function FakeSlider({
  fill,
  label,
}: {
  fill: number;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox="0 0 24 24"
        className="h-4 w-4 flex-none text-parchment-400"
        fill="currentColor"
      >
        <path d="M3 10v4h4l5 5V5L7 10H3z" />
      </svg>
      <div className="relative h-1.5 w-full rounded-full bg-ink-700">
        <div
          className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-ember-600 to-ember-400"
          style={{ width: `${fill}%` }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 -translate-x-1/2 rounded-full bg-ember-300 shadow-glow-sm"
          style={{ left: `${fill}%` }}
        />
      </div>
      <span className="w-10 flex-none text-right font-mono text-[11px] text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export default function StyleGuidePage() {
  return (
    <div className="flex-1">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:px-10">
        {/* Intro */}
        <header className="mb-18">
          <SectionLabel>Lyriad · Design System</SectionLabel>
          <h1 className="mt-2 font-display text-5xl font-medium tracking-wide text-parchment-100">
            Style Guide
          </h1>
          <p className="mt-4 max-w-xl text-parchment-400">
            Mörk bas, varma accenter. Sten och pergament som idé — inte som
            bokstavlig textur. Denna sida finns för att godkänna riktningen
            innan resten av UI:t byggs.
          </p>
        </header>

        {/* Colors */}
        <section className="mb-18">
          <SectionLabel>Färg</SectionLabel>
          <SectionTitle>Palette</SectionTitle>
          <p className="mt-2 max-w-xl text-sm text-muted-foreground">
            <span className="text-parchment-300">ink</span> är den nästan
            svarta basen med en kall, blå underton.{" "}
            <span className="text-ember-400">ember</span> är den varma accenten
            — guld, koppar, glödande orange — reserverad för det som går att
            interagera med.{" "}
            <span className="text-parchment-300">parchment</span> bär text.{" "}
            <span className="text-wine-400">wine</span> är reserverad för
            destruktiva åtgärder.
          </p>
          <div className="mt-8 flex flex-col gap-8">
            <ColorSwatchRow name="ink" scale={inkScale} />
            <ColorSwatchRow name="ember" scale={emberScale} />
            <ColorSwatchRow name="parchment" scale={parchmentScale} />
            <ColorSwatchRow name="wine" scale={wineScale} />
          </div>
        </section>

        {/* Typography */}
        <section className="mb-18">
          <SectionLabel>Typografi</SectionLabel>
          <SectionTitle>Type</SectionTitle>
          <div className="mt-8 flex flex-col gap-8">
            <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
              <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                font-display · Cinzel — rubriker, sparsamt
              </p>
              <p className="font-display text-5xl font-medium tracking-wide text-parchment-100">
                Old Owl Well
              </p>
              <p className="mt-3 font-display text-2xl font-medium tracking-wide text-parchment-200">
                Thundertree / Conyberry
              </p>
              <p className="mt-3 font-display text-base font-medium tracking-[0.15em] text-ember-400 uppercase">
                Scene III
              </p>
            </div>
            <div className="rounded-lg border border-border bg-surface p-8 shadow-sm">
              <p className="mb-4 font-mono text-xs uppercase tracking-widest text-muted-foreground">
                font-sans · Inter — brödtext &amp; UI
              </p>
              <p className="text-xl font-semibold text-parchment-100">
                Reidoths House Ambience
              </p>
              <p className="mt-2 text-base text-parchment-300">
                Regular 16px — för beskrivningar, listor och längre text som
                behöver vara lätt att läsa i mörkt läge.
              </p>
              <p className="mt-2 text-sm text-muted-foreground">
                Small / muted 14px — metadata, hjälptext, tidsstämplar.
              </p>
              <p className="mt-3 font-mono text-sm text-muted-foreground">
                font-mono · 1:02:21 — siffror som ska stå still i en lista
              </p>
            </div>
          </div>
        </section>

        {/* Spacing */}
        <section className="mb-18">
          <SectionLabel>Layout</SectionLabel>
          <SectionTitle>Spacing</SectionTitle>
          <div className="mt-8 flex flex-col gap-3">
            {spacingSteps.map(([step, rem]) => (
              <div key={step} className="flex items-center gap-4">
                <span className="w-10 font-mono text-xs text-muted-foreground">
                  {step}
                </span>
                <div
                  className="h-4 rounded-sm bg-ember-500/70"
                  style={{ width: rem }}
                />
                <span className="font-mono text-xs text-muted-foreground">
                  {rem}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Radius & shadow */}
        <section className="mb-18 grid grid-cols-1 gap-12 sm:grid-cols-2">
          <div>
            <SectionLabel>Form</SectionLabel>
            <SectionTitle>Radius</SectionTitle>
            <div className="mt-8 flex flex-wrap gap-4">
              {radiusSteps.map(([step, cls]) => (
                <div key={step} className="text-center">
                  <div
                    className={`h-16 w-16 border border-border-strong bg-surface-elevated ${cls}`}
                  />
                  <p className="mt-1.5 font-mono text-xs text-muted-foreground">
                    {step}
                  </p>
                </div>
              ))}
            </div>
          </div>
          <div>
            <SectionLabel>Djup</SectionLabel>
            <SectionTitle>Shadow</SectionTitle>
            <div className="mt-8 flex flex-wrap gap-4">
              {shadowSteps.map(([step, cls]) => (
                <div key={step} className="text-center">
                  <div
                    className={`h-16 w-16 rounded-lg bg-surface-elevated ${cls}`}
                  />
                  <p className="mt-1.5 font-mono text-xs text-muted-foreground">
                    {step}
                  </p>
                </div>
              ))}
              <div className="text-center">
                <div className="h-16 w-16 rounded-lg bg-surface-elevated shadow-glow" />
                <p className="mt-1.5 font-mono text-xs text-muted-foreground">
                  glow
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Buttons */}
        <section className="mb-18">
          <SectionLabel>Komponent</SectionLabel>
          <SectionTitle>Buttons</SectionTitle>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <button
              type="button"
              className="rounded-md bg-gradient-to-b from-ember-400 to-ember-500 px-5 py-2.5 text-sm font-medium text-ink-950 shadow-sm transition hover:shadow-glow-sm active:from-ember-500 active:to-ember-600"
            >
              Primary
            </button>
            <button
              type="button"
              className="rounded-md border border-border-strong bg-surface px-5 py-2.5 text-sm font-medium text-parchment-100 transition hover:border-ember-400/60 hover:text-ember-300"
            >
              Secondary
            </button>
            <button
              type="button"
              className="rounded-md px-5 py-2.5 text-sm font-medium text-parchment-400 transition hover:text-ember-300"
            >
              Ghost
            </button>
            <button
              type="button"
              className="rounded-md border border-wine-600/60 bg-wine-600/10 px-5 py-2.5 text-sm font-medium text-wine-400 transition hover:bg-wine-600/20 hover:text-wine-400"
            >
              Destructive
            </button>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-md bg-ink-700 px-5 py-2.5 text-sm font-medium text-parchment-500/50"
            >
              Disabled
            </button>
            <button
              type="button"
              aria-label="Mer"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-border-strong bg-surface text-parchment-300 transition hover:border-ember-400/60 hover:text-ember-300"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                <circle cx="12" cy="5" r="1.6" />
                <circle cx="12" cy="12" r="1.6" />
                <circle cx="12" cy="19" r="1.6" />
              </svg>
            </button>
          </div>
        </section>

        {/* Tabs */}
        <section className="mb-18">
          <SectionLabel>Komponent</SectionLabel>
          <SectionTitle>Tabs</SectionTitle>
          <div className="mt-8 flex flex-wrap gap-2">
            {["Scene I", "Scene II", "Scene III", "Scene IV", "Scene V"].map(
              (label, i) => (
                <button
                  key={label}
                  type="button"
                  className={
                    i === 2
                      ? "rounded-full bg-ember-400 px-4 py-1.5 text-sm font-medium text-ink-950 shadow-glow-sm"
                      : "rounded-full px-4 py-1.5 text-sm font-medium text-parchment-400 transition hover:text-parchment-100"
                  }
                >
                  {label}
                </button>
              ),
            )}
          </div>
        </section>

        {/* Tags */}
        <section className="mb-18">
          <SectionLabel>Komponent</SectionLabel>
          <SectionTitle>Tags</SectionTitle>
          <div className="mt-8 flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="rounded-md border border-border-strong bg-surface-elevated px-3 py-1.5 text-xs text-parchment-300"
              >
                {tag}
              </span>
            ))}
            <button
              type="button"
              aria-label="Lägg till tagg"
              className="flex h-8 w-8 items-center justify-center rounded-md border border-dashed border-border-strong text-parchment-500 transition hover:border-ember-400/60 hover:text-ember-300"
            >
              +
            </button>
          </div>
        </section>

        {/* Slider */}
        <section className="mb-18">
          <SectionLabel>Komponent</SectionLabel>
          <SectionTitle>Sliders</SectionTitle>
          <div className="mt-8 max-w-md rounded-lg border border-border bg-surface p-8 shadow-sm">
            <div className="flex flex-col gap-4">
              <FakeSlider fill={72} label="72%" />
              <FakeSlider fill={35} label="35%" />
              <FakeSlider fill={100} label="100%" />
            </div>
          </div>
        </section>

        {/* Card */}
        <section>
          <SectionLabel>Komponent</SectionLabel>
          <SectionTitle>Card</SectionTitle>
          <div className="mt-8 grid max-w-md gap-3">
            <div className="group flex items-center gap-3 rounded-lg border border-border bg-surface p-3 shadow-sm transition hover:border-ember-400/40 hover:shadow-md">
              <div className="h-11 w-11 flex-none rounded-md bg-gradient-to-br from-ink-700 to-ink-900" />
              <div className="flex-1 overflow-hidden">
                <p className="truncate text-sm font-medium text-parchment-100">
                  Thundertree Roaming
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <svg
                    viewBox="0 0 24 24"
                    className="h-3 w-3 flex-none text-parchment-500"
                    fill="currentColor"
                  >
                    <path d="M3 10v4h4l5 5V5L7 10H3z" />
                  </svg>
                  <div className="relative h-1 w-full rounded-full bg-ink-700">
                    <div className="absolute inset-y-0 left-0 w-2/3 rounded-full bg-ember-500" />
                  </div>
                </div>
              </div>
              <span className="flex-none font-mono text-xs text-muted-foreground">
                1:02:21
              </span>
              <button
                type="button"
                aria-label="Mer"
                className="flex-none text-parchment-500 opacity-0 transition group-hover:opacity-100 hover:text-ember-300"
              >
                <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                  <circle cx="12" cy="5" r="1.6" />
                  <circle cx="12" cy="12" r="1.6" />
                  <circle cx="12" cy="19" r="1.6" />
                </svg>
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
