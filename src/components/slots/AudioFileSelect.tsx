"use client";

import type { AudioFileWithMeta } from "@/types/domain";

type AudioFileSelectProps = {
  files: AudioFileWithMeta[];
  disabled?: boolean;
  onSelect: (audioFileId: string) => void;
};

export function AudioFileSelect({ files, disabled, onSelect }: AudioFileSelectProps) {
  return (
    <select
      value=""
      disabled={disabled || files.length === 0}
      onChange={(e) => {
        if (e.target.value) onSelect(e.target.value);
      }}
      className="rounded-md border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 disabled:opacity-40"
    >
      <option value="" disabled>
        {files.length === 0 ? "Inga filer i biblioteket" : "Välj ljudfil…"}
      </option>
      {files.map((file) => (
        <option key={file.id} value={file.id}>
          {file.filename}
        </option>
      ))}
    </select>
  );
}
