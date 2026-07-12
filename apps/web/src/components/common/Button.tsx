"use client";

import type { ButtonHTMLAttributes } from "react";
import type { LucideIcon } from "lucide-react";
import styles from "./Button.module.css";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  icon?: LucideIcon;
}

export function Button({ variant = "primary", icon: Icon, className, children, ...props }: ButtonProps) {
  return (
    <button className={[styles.button, styles[variant], className].filter(Boolean).join(" ")} {...props}>
      {Icon && <Icon size={16} strokeWidth={2.25} aria-hidden />}
      {children}
    </button>
  );
}
