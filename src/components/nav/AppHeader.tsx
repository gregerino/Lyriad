"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { LibraryIcon, MenuIcon, MixerIcon, ScenesIcon, XIcon } from "@/components/ui/icons";

const NAV_ITEMS = [
  { href: "/", label: "Mixer", icon: MixerIcon, isActive: (path: string) => path === "/" || /^\/scenes\/[^/]+$/.test(path) },
  { href: "/scenes", label: "Scener", icon: ScenesIcon, isActive: (path: string) => path === "/scenes" },
  { href: "/library", label: "Ljudbibliotek", icon: LibraryIcon, isActive: (path: string) => path.startsWith("/library") },
];

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

  if (pathname === "/login") return null;

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-surface/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <button
            type="button"
            onClick={() => setOpen(true)}
            aria-label="Öppna meny"
            aria-expanded={open}
            className="focus-ring flex h-9 w-9 flex-none items-center justify-center rounded-md text-parchment-300 transition hover:bg-surface-elevated hover:text-ember-300"
          >
            <MenuIcon className="h-5 w-5" />
          </button>
          <Link
            href="/"
            className="focus-ring rounded-sm font-display text-sm font-medium tracking-[0.2em] text-parchment-100 uppercase"
          >
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

      <nav
        aria-hidden={!open}
        aria-label="Huvudmeny"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-1 border-r border-border bg-surface p-4 shadow-lg transition-transform duration-200 ${
          open ? "translate-x-0" : "pointer-events-none -translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="font-display text-sm font-medium tracking-[0.2em] text-parchment-100 uppercase">
            Lyriad
          </span>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Stäng meny"
            className="focus-ring flex h-8 w-8 items-center justify-center rounded-md text-parchment-400 transition hover:bg-surface-elevated hover:text-ember-300"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>

        {NAV_ITEMS.map((item) => {
          const active = item.isActive(pathname);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className={`focus-ring flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "border-l-2 border-ember-400 bg-ember-400/10 text-ember-300"
                  : "border-l-2 border-transparent text-parchment-300 hover:bg-surface-elevated hover:text-parchment-100"
              }`}
            >
              <Icon className="h-4 w-4 flex-none" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
