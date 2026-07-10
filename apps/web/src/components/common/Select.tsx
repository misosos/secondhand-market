"use client";

import type { SelectHTMLAttributes } from "react";
import { ChevronDown } from "lucide-react";
import styles from "./Select.module.css";

type SelectProps = SelectHTMLAttributes<HTMLSelectElement>;

// Native <select> underneath (keeps keyboard/screen-reader behavior free)
// with the browser's own arrow hidden and a matching lucide chevron drawn
// on top instead — the popup listbox itself is still OS-native, but the
// trigger now looks like the rest of the design system's pill inputs.
export function Select({ className, children, ...props }: SelectProps) {
  return (
    <div className={styles.wrap}>
      <select className={[styles.select, className].filter(Boolean).join(" ")} {...props}>
        {children}
      </select>
      <ChevronDown size={16} strokeWidth={2} className={styles.chevron} aria-hidden />
    </div>
  );
}
