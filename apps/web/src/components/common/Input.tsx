"use client";

import type { InputHTMLAttributes } from "react";
import styles from "./Field.module.css";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
}

export function Input({ label, id, className, ...props }: InputProps) {
  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      <input id={id} className={[styles.control, className].filter(Boolean).join(" ")} {...props} />
    </div>
  );
}
