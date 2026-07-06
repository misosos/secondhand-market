"use client";

import { useCallback, useEffect, useState } from "react";

type Theme = "light" | "dark";

// Null until mounted: the server has no idea what the user's stored
// preference (or system preference) is, so resolving this in useEffect
// (client-only) avoids a hydration mismatch instead of guessing.
export function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    const current = document.documentElement.getAttribute("data-theme");
    if (current === "light" || current === "dark") {
      setTheme(current);
      return;
    }
    setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => {
      const next: Theme = prev === "dark" ? "light" : "dark";
      document.documentElement.setAttribute("data-theme", next);
      localStorage.setItem("theme", next);
      return next;
    });
  }, []);

  return { theme, toggleTheme };
}
