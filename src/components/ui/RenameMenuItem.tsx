"use client";

import { useEffect, useRef, useState } from "react";
import { PencilIcon } from "@/components/ui/icons";

type RenameMenuItemProps = {
  /** The name as it currently reads — a custom one, or the underlying default. */
  value: string;
  /**
   * Shown as the placeholder. Typing it back — or clearing the field — commits
   * `null`, which each caller reads its own way: a slot drops its override and
   * follows its file again, a scene simply keeps the name it has.
   */
  fallback: string;
  onCommit: (name: string | null) => void;
  /** Called on Enter, so the host can close the menu around this field. */
  onDone: () => void;
  /** The host menu's own item styling, so this row matches its neighbours. */
  itemClassName: string;
  /** Overrides the row's wording where "Byt namn" alone would be ambiguous. */
  label?: string;
};

/**
 * A rename row for a kebab/settings menu, shared by music cards, one-shot pads
 * and the mixer menu. It is a plain menu item until chosen, and only then turns
 * into an input — these menus carry other actions too, and a name field sitting
 * open in one invites stray keystrokes and raises the keyboard on touch.
 *
 * Lives inside the popover panel on purpose: the panel unmounts on close, so
 * the menu is back to its resting state the next time it opens, for free.
 */
export function RenameMenuItem({
  value,
  fallback,
  onCommit,
  onDone,
  itemClassName,
  label = "Byt namn",
}: RenameMenuItemProps) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button type="button" onClick={() => setEditing(true)} className={itemClassName}>
        <PencilIcon className="h-3.5 w-3.5 flex-none" />
        {label}
      </button>
    );
  }

  return <NameField value={value} fallback={fallback} onCommit={onCommit} onDone={onDone} />;
}

/**
 * Commits when it unmounts as well as on blur, because the menu closes on
 * click-outside — which tears the input down without ever firing blur, and a
 * name someone just typed shouldn't disappear with the panel.
 */
function NameField({
  value,
  fallback,
  onCommit,
  onDone,
}: Omit<RenameMenuItemProps, "itemClassName" | "label">) {
  const [draft, setDraft] = useState(value);

  // Held in a ref so the unmount cleanup below can reach the *final* draft. It
  // is refreshed after every render rather than during one, so the cleanup that
  // runs on unmount sees whatever the last committed render left behind.
  const commitRef = useRef<() => void>(() => {});
  useEffect(() => {
    commitRef.current = () => {
      const trimmed = draft.trim();
      onCommit(trimmed === "" || trimmed === fallback ? null : trimmed);
    };
  });

  useEffect(() => () => commitRef.current(), []);

  return (
    <label className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
        Namn
      </span>
      <input
        type="text"
        value={draft}
        // Safe to grab focus here, unlike in the resting menu: reaching this
        // input took an explicit "Byt namn", so typing is the whole intent.
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => commitRef.current()}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            onDone();
          }
          if (e.key === "Escape" && draft !== value) {
            // Swallowed, or Popover's own Escape listener closes the panel and
            // the unmount commit would persist the draft we're discarding. Once
            // there is nothing left to revert, Escape closes the panel as usual.
            e.stopPropagation();
            setDraft(value);
          }
        }}
        placeholder={fallback}
        className="focus-ring w-full rounded-md border border-border-strong bg-background px-2 py-1 text-xs text-parchment-100 placeholder:text-muted-foreground focus:border-ember-400"
      />
    </label>
  );
}
