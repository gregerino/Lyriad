// TEMPORARY: diagnostics for music tracks showing 00:00 and refusing to seek on
// iPad. Only active with ?debug=audio in the address. Remove once the cause is
// found.

type Entry = { name: string; element: HTMLAudioElement; events: string[] };

const entries = new Map<string, Entry>();
const startedAt = Date.now();

const EVENTS = [
  "loadstart",
  "loadedmetadata",
  "durationchange",
  "loadeddata",
  "canplay",
  "canplaythrough",
  "playing",
  "pause",
  "seeking",
  "seeked",
  "stalled",
  "suspend",
  "waiting",
  "ended",
  "error",
  "emptied",
  "abort",
] as const;

export function isAudioDebugEnabled(): boolean {
  return typeof window !== "undefined" && window.location.search.includes("debug=audio");
}

function stamp(): string {
  return ((Date.now() - startedAt) / 1000).toFixed(1);
}

export function formatNumber(value: number): string {
  if (Number.isNaN(value)) return "NaN";
  if (!Number.isFinite(value)) return String(value);
  // Enough digits that a sliver of a second does not pass for zero.
  return value < 10 ? value.toPrecision(3) : value.toFixed(1);
}

/** Records what the browser reports about an element, event by event. */
export function registerDebugElement(id: string, name: string, element: HTMLAudioElement): void {
  if (!isAudioDebugEnabled()) return;
  const entry: Entry = { name, element, events: [] };
  entries.set(id, entry);
  for (const type of EVENTS) {
    element.addEventListener(type, () => {
      entry.events.push(`${stamp()}s ${type} d=${formatNumber(element.duration)}`);
      if (entry.events.length > 14) entry.events.shift();
    });
  }
}

export function getDebugEntries(): [string, Entry][] {
  return [...entries];
}
