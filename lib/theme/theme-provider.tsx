"use client";

import { useEffect } from "react";

import { useSettingsStore } from "@/lib/stores/use-settings-store";

const DARK_QUERY = "(prefers-color-scheme: dark)";

export function ThemeProvider({ children }: Readonly<{ children: React.ReactNode }>) {
  const appearance = useSettingsStore((s) => s.appearance);

  useEffect(() => {
    const mediaQuery = window.matchMedia(DARK_QUERY);

    function applyTheme() {
      const shouldUseDark =
        appearance === "dark" || (appearance === "system" && mediaQuery.matches);

      document.documentElement.classList.toggle("dark", shouldUseDark);
      document.documentElement.style.colorScheme = shouldUseDark ? "dark" : "light";
    }

    applyTheme();

    if (appearance !== "system") {
      return;
    }

    mediaQuery.addEventListener("change", applyTheme);
    return () => mediaQuery.removeEventListener("change", applyTheme);
  }, [appearance]);

  return children;
}
