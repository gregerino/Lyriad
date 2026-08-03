"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { XIcon } from "@/components/ui/icons";

export type Notice = {
  /** Distinguishes consecutive notices with identical text, so the timer restarts. */
  id: number;
  message: string;
  tone: "info" | "danger";
  action?: { label: string; onAction: () => void };
};

/** How long a notice stays up before it dismisses itself. Undo needs the longer end of "glanceable". */
const NOTICE_TIMEOUT_MS = 8000;

/**
 * Hands back a `notify` to post a notice and the element that shows it. Kept as
 * a hook rather than a context provider because every caller so far is a single
 * page-level component, and a provider would buy nothing but indirection.
 */
export function useNotice() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const nextId = useRef(0);

  const notify = useCallback(
    (message: string, options: Omit<Notice, "id" | "message"> = { tone: "info" }) => {
      nextId.current += 1;
      setNotice({ id: nextId.current, message, tone: options.tone, action: options.action });
    },
    []
  );

  // Stable, because the bar's dismiss timer keys off it — a fresh identity on
  // every parent render would restart the countdown for as long as the mixer
  // kept re-rendering, which on a playing scene is forever.
  const dismiss = useCallback(() => setNotice(null), []);

  return { notify, dismiss, notice };
}

type NoticeBarProps = {
  notice: Notice | null;
  onDismiss: () => void;
};

/**
 * A single transient message, docked to the bottom of the viewport. One at a
 * time on purpose: these report things that just happened to something the user
 * is looking at, and a stack of them would compete with the desk itself.
 *
 * The alternative to an undo here would be a confirm dialog on every clear,
 * which is the wrong trade mid-session — it taxes the ninety-nine correct
 * clicks to catch the one mistake.
 */
export function NoticeBar({ notice, onDismiss }: NoticeBarProps) {
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(onDismiss, NOTICE_TIMEOUT_MS);
    return () => clearTimeout(timer);
    // A replacement notice is a new object, so it restarts the clock rather
    // than inheriting whatever was left of the previous one's.
  }, [notice, onDismiss]);

  if (!notice) return null;

  return (
    <div
      // `status` rather than `alert`: these are confirmations of something the
      // user just did, so they shouldn't interrupt what a screen reader is saying.
      role="status"
      aria-live="polite"
      className="animate-page-fade pointer-events-none fixed inset-x-0 bottom-4 z-50 flex justify-center px-4"
    >
      <div
        className={`pointer-events-auto flex max-w-[calc(100vw-2rem)] items-center gap-3 rounded-lg border bg-surface-elevated py-2 pl-4 pr-2 shadow-lg ${
          notice.tone === "danger" ? "border-wine-500/60" : "border-border-strong"
        }`}
      >
        <p
          className={`min-w-0 text-sm ${
            notice.tone === "danger" ? "text-danger-foreground" : "text-parchment-100"
          }`}
        >
          {notice.message}
        </p>

        {notice.action && (
          <button
            type="button"
            onClick={() => {
              notice.action?.onAction();
              onDismiss();
            }}
            className="focus-ring flex-none rounded-md px-2 py-1 text-sm font-medium text-ember-300 transition hover:bg-ink-700 hover:text-ember-200"
          >
            {notice.action.label}
          </button>
        )}

        <button
          type="button"
          onClick={onDismiss}
          aria-label="Stäng meddelandet"
          className="focus-ring flex h-7 w-7 flex-none items-center justify-center rounded-md text-muted-foreground transition hover:bg-ink-700 hover:text-parchment-100"
        >
          <XIcon className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
