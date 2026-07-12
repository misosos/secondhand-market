import type { ReactNode } from "react";
import styles from "./FormCard.module.css";

interface FormCardProps {
  children: ReactNode;
  className?: string;
}

export function FormCard({ children, className }: FormCardProps) {
  return <div className={[styles.card, className].filter(Boolean).join(" ")}>{children}</div>;
}
