"use client";

import { useState } from "react";

type TagEditorProps = {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
};

export function TagEditor({ tags, onChange, placeholder }: TagEditorProps) {
  const [input, setInput] = useState("");

  function commitInput() {
    const pieces = input
      .split(",")
      .map((piece) => piece.trim())
      .filter((piece) => piece.length > 0);
    setInput("");
    if (pieces.length === 0) return;

    const next = [...tags];
    for (const piece of pieces) {
      if (!next.includes(piece)) next.push(piece);
    }
    onChange(next);
  }

  function removeTag(tag: string) {
    onChange(tags.filter((t) => t !== tag));
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <span
          key={tag}
          className="flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-200"
        >
          {tag}
          <button
            type="button"
            onClick={() => removeTag(tag)}
            className="text-zinc-500 hover:text-red-400"
            aria-label={`Ta bort tagg ${tag}`}
          >
            ×
          </button>
        </span>
      ))}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === ",") {
            e.preventDefault();
            commitInput();
          } else if (e.key === "Backspace" && input === "" && tags.length > 0) {
            removeTag(tags[tags.length - 1]!);
          }
        }}
        onBlur={commitInput}
        placeholder={placeholder ?? "Lägg till tagg…"}
        className="min-w-[6rem] flex-1 bg-transparent px-1 py-0.5 text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none"
      />
    </div>
  );
}
