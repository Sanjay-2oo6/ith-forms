import { useEffect, useState } from "react";
import type { AppearanceDefault } from "@/lib/use-app-settings";

export type ThemeMode = "light" | "dark";

function resolveDefault(mode: AppearanceDefault): ThemeMode {
  if (mode === "system") {
    return typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light" : "dark";
  }
  return mode;
}

// Shared light/dark theme control. Applies the mode to <html>; a user's
// explicit choice persists under the 'theme' key so the admin shell and the
// login page stay in sync.
//
// `defaultAppearance` (from app settings) is applied ONLY while the user has
// never chosen a theme themselves — the stored preference is written on
// explicit toggle/set, never when merely applying the default, so changing
// the app-wide default later still affects users who never picked one.
export function useTheme(defaultAppearance?: AppearanceDefault) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("theme") as ThemeMode | null;
      if (stored === "light" || stored === "dark") return stored;
      return resolveDefault(defaultAppearance ?? "dark");
    }
    return "dark";
  });

  // Settings load async: adopt the configured default once it arrives,
  // but never override an explicit user choice.
  useEffect(() => {
    if (!defaultAppearance) return;
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark") return;
    setThemeState(resolveDefault(defaultAppearance));
  }, [defaultAppearance]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(theme);
  }, [theme]);

  const persist = (next: ThemeMode) => {
    localStorage.setItem("theme", next);
    setThemeState(next);
  };

  const toggle = () => persist(theme === "dark" ? "light" : "dark");
  return { theme, toggle, setTheme: persist };
}
