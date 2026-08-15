"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

/**
 * Display preferences.
 *
 * Two things a ward actually needs to change, and nothing else. Night mode,
 * because the 03:00 round happens in a dark room and the daytime cream is a
 * light source in it. And a motion switch, because `prefers-reduced-motion` is
 * an OS setting many people never find, and a nurse who wants the screen to
 * hold still should not have to leave the app to arrange it.
 *
 * Both are applied as attributes on <html> so the CSS in globals.css can act on
 * them without a single component knowing which theme is live.
 */

const KEY = "clario.prefs.v1";

export type Theme = "light" | "dark";

interface Prefs {
  theme: Theme;
  calmMotion: boolean;
}

const DEFAULTS: Prefs = { theme: "light", calmMotion: false };

interface PrefsApi extends Prefs {
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setCalmMotion: (calm: boolean) => void;
  /** True when motion should be suppressed — the OS asked, or the reader did. */
  calm: boolean;
}

const Ctx = createContext<PrefsApi | null>(null);

export function PrefsProvider({ children }: { children: React.ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [systemCalm, setSystemCalm] = useState(false);

  // Read after mount: the server has no window, and hydrating from one would
  // guarantee a mismatch.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) });
    } catch {
      // Storage disabled — defaults are fine, the session still works.
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setSystemCalm(mq.matches);
    const onChange = () => setSystemCalm(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", prefs.theme);
    root.toggleAttribute("data-calm", prefs.calmMotion);
    try {
      window.localStorage.setItem(KEY, JSON.stringify(prefs));
    } catch {
      // Preference still applies for this session.
    }
  }, [prefs]);

  const api = useMemo<PrefsApi>(
    () => ({
      ...prefs,
      calm: prefs.calmMotion || systemCalm,
      setTheme: (theme) => setPrefs((p) => ({ ...p, theme })),
      toggleTheme: () =>
        setPrefs((p) => ({ ...p, theme: p.theme === "dark" ? "light" : "dark" })),
      setCalmMotion: (calmMotion) => setPrefs((p) => ({ ...p, calmMotion })),
    }),
    [prefs, systemCalm],
  );

  return <Ctx.Provider value={api}>{children}</Ctx.Provider>;
}

export function usePrefs(): PrefsApi {
  const value = useContext(Ctx);
  if (!value) throw new Error("usePrefs must be used inside PrefsProvider");
  return value;
}

/** Motion check for code paths that run outside React (timers, canvas loops). */
export function calmNow(): boolean {
  if (typeof document === "undefined") return false;
  return (
    document.documentElement.hasAttribute("data-calm") ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}
