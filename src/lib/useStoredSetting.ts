"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A preference that should outlive the page but has no business on the server —
 * which fade length is armed, whether empty pads are shown. Read after mount
 * rather than during render, so the server-rendered markup and the first client
 * render agree and hydration stays quiet; the fallback shows for one frame.
 */
export function useStoredSetting<T>(key: string, fallback: T): [T, (value: T) => void] {
  const [value, setValue] = useState<T>(fallback);

  useEffect(() => {
    const raw = window.localStorage.getItem(key);
    if (raw === null) return;
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reading localStorage is the one thing that can't happen during render
      setValue(JSON.parse(raw) as T);
    } catch {
      // Something else wrote nonsense under this key, or the shape changed
      // between versions. Either way the fallback is the better answer.
      window.localStorage.removeItem(key);
    }
  }, [key]);

  const update = useCallback(
    (next: T) => {
      setValue(next);
      window.localStorage.setItem(key, JSON.stringify(next));
    },
    [key]
  );

  return [value, update];
}
