"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { QuickAccessPanel } from "@/components/nav/QuickAccessPanel";
import { Tooltip } from "@/components/ui/Tooltip";
import { MenuIcon, XIcon } from "@/components/ui/icons";

export function AppHeader() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  // The drawer scrolls its own list; letting the page scroll behind it on a
  // tablet drags the mixer around under the user's thumb.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  if (pathname === "/login") return null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <Tooltip label="Meny" placement="bottom" align="start" className="flex-none">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Öppna meny"
              aria-expanded={open}
              className="focus-ring flex h-9 w-9 flex-none items-center justify-center rounded-md text-parchment-300 transition hover:bg-surface-elevated hover:text-ember-300"
            >
              <MenuIcon className="h-5 w-5" />
            </button>
          </Tooltip>
          <Link
            href="/"
            className="focus-ring flex items-center gap-2.5 rounded-sm font-display text-sm font-medium tracking-[0.2em] text-parchment-100 uppercase"
          >
            <Image
              src="/lyriad-icon.png"
              alt=""
              width={64}
              height={64}
              priority
              className="h-8 w-8 flex-none"
            />
            Lyriad
          </Link>
        </div>
      </header>

      <div
        role="presentation"
        onClick={() => setOpen(false)}
        className={`fixed inset-0 z-50 bg-ink-950/70 backdrop-blur-sm transition-opacity duration-200 ${
          open ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />

      <div
        // `inert` rather than aria-hidden: the closed drawer keeps its scene
        // list mounted, and its links must be out of reach of Tab as well as
        // out of the accessibility tree.
        inert={!open}
        aria-label="Snabbåtkomst"
        className={`fixed inset-y-0 left-0 z-50 flex w-[21rem] max-w-[85vw] flex-col border-r border-border bg-surface p-4 shadow-lg transition-transform duration-200 sm:w-[23rem] ${
          open ? "translate-x-0" : "pointer-events-none -translate-x-full"
        }`}
      >
        <div className="mb-4 flex flex-none items-center justify-between">
          <span className="flex items-center gap-2.5 font-display text-sm font-medium tracking-[0.2em] text-parchment-100 uppercase">
            <Image
              src="/lyriad-icon.png"
              alt=""
              width={64}
              height={64}
              className="h-8 w-8 flex-none"
            />
            Lyriad
          </span>
          <Tooltip label="Stäng" placement="bottom" align="end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Stäng meny"
              className="focus-ring flex h-9 w-9 items-center justify-center rounded-md text-parchment-400 transition hover:bg-surface-elevated hover:text-ember-300"
            >
              <XIcon className="h-4 w-4" />
            </button>
          </Tooltip>
        </div>

        <QuickAccessPanel open={open} pathname={pathname} onClose={() => setOpen(false)} />
      </div>
    </>
  );
}
