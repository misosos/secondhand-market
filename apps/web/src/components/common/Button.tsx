"use client";

import type { ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
}

export function Button({ variant = "primary", className, ...props }: ButtonProps) {
  return <button className={[styles.button, styles[variant], className].filter(Boolean).join(" ")} {...props} />;
}
