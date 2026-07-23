"use client";

import type { ReactNode } from "react";
import type { AudioFileWithMeta } from "@/types/domain";

type AudioFileSelectProps = {
  files: AudioFileWithMeta[];
  disabled?: boolean;
  onSelect: (audioFileId: string) => void;
  placeholder?: string;
  className?: string;
  /**
   * When provided, the select becomes an invisible full-size hit target
   * layered over this visual — lets a pad/row render its own empty-state
   * look while keeping the native <select> for actual assignment.
   */
  overlay?: ReactNode;
};

export function AudioFileSelect({
  files,
  disabled,
  onSelect,
  placeholder,
  className,
  overlay,
}: AudioFileSelectProps) {
  const select = (
    <select
      value=""
      disabled={disabled || files.length === 0}
      onChange={(e) => {
        if (e.target.value) onSelect(e.target.value);
      }}
      className={
        overlay
          ? "focus-ring absolute inset-0 h-full w-full cursor-pointer rounded-lg opacity-0 disabled:cursor-not-allowed"
          : (className ??
            "focus-ring rounded-md border border-border-strong bg-background px-2 py-1.5 text-xs text-parchment-100 focus:border-ember-400 disabled:opacity-40")
      }
    >
      <option value="" disabled>
        {files.length === 0 ? "Inga filer i biblioteket" : (placeholder ?? "Välj ljudfil…")}
      </option>
      {files.map((file) => (
        <option key={file.id} value={file.id}>
          {file.filename}
        </option>
      ))}
    </select>
  );

  if (!overlay) return select;

  return (
    <div className="group relative">
      {overlay}
      {select}
    </div>
  );
}
