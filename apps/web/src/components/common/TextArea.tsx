"use client";

import type { TextareaHTMLAttributes } from "react";
import styles from "./Field.module.css";

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
}

export function TextArea({ label, id, className, ...props }: TextAreaProps) {
  return (
    <div className={styles.field}>
      {label && (
        <label className={styles.label} htmlFor={id}>
          {label}
        </label>
      )}
      <textarea id={id} className={[styles.control, styles.textarea, className].filter(Boolean).join(" ")} {...props} />
    </div>
  );
}
