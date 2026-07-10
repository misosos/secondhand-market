"use client";

import type { InputHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./Field.module.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  icon?: LucideIcon;
}

export function Input({ label, icon: Icon, id, className, ...props }: InputProps) {
  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      <div className={styles.controlWrap}>
        {Icon && <Icon size={16} strokeWidth={2} className={styles.controlIcon} aria-hidden />}
        <input
          id={id}
          className={[styles.control, Icon && styles.hasIcon, className].filter(Boolean).join(" ")}
          {...props}
        />
      </div>
    </div>
  );
}
