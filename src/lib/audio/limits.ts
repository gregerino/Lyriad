/** Shared between client and server — no node-only APIs here. */

export const MAX_AUDIO_UPLOAD_BYTES = 105 * 1024 * 1024;

export const ALLOWED_AUDIO_EXTENSIONS = ["mp3", "wav", "ogg"] as const;
export type AllowedAudioExtension = (typeof ALLOWED_AUDIO_EXTENSIONS)[number];

const EXTENSION_MIME_TYPES: Record<AllowedAudioExtension, string> = {
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
};

export function getFileExtension(filename: string): string | null {
  const match = /\.([a-zA-Z0-9]+)$/.exec(filename);
  return match ? match[1]!.toLowerCase() : null;
}

function isAllowedExtension(ext: string | null): ext is AllowedAudioExtension {
  return !!ext && (ALLOWED_AUDIO_EXTENSIONS as readonly string[]).includes(ext);
}

/** The MIME type we trust and store — derived from the extension, not the browser-reported type. */
export function getCanonicalMimeType(filename: string): string | null {
  const ext = getFileExtension(filename);
  return isAllowedExtension(ext) ? EXTENSION_MIME_TYPES[ext] : null;
}

export function isAllowedAudioFilename(filename: string): boolean {
  return isAllowedExtension(getFileExtension(filename));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return `${value.toFixed(1)} ${units[unitIndex]}`;
}
