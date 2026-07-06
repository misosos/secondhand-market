"use client";

import { useTheme } from "@/features/theme/useTheme";
import styles from "./ThemeToggle.module.css";

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2.5v2.4M12 19.1v2.4M4.4 4.4l1.7 1.7M17.9 17.9l1.7 1.7M2.5 12h2.4M19.1 12h2.4M4.4 19.6l1.7-1.7M17.9 6.1l1.7-1.7" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
      <path d="M20.5 14.6a8.7 8.7 0 01-10.9-10.9 1 1 0 00-1.3-1.2A9.9 9.9 0 1021.7 15.9a1 1 0 00-1.2-1.3z" />
    </svg>
  );
}

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      type="button"
      className={styles.toggle}
      onClick={toggleTheme}
      aria-label={theme === "dark" ? "라이트 모드로 전환" : "다크 모드로 전환"}
      aria-pressed={theme === "dark"}
    >
      {theme === "dark" ? <MoonIcon /> : <SunIcon />}
    </button>
  );
}
