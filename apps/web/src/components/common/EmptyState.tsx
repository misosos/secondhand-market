import type { LucideIcon } from "lucide-react";
import styles from "./EmptyState.module.css";

interface EmptyStateProps {
  icon: LucideIcon;
  message: string;
}

export function EmptyState({ icon: Icon, message }: EmptyStateProps) {
  return (
    <div className={styles.wrap}>
      <Icon size={28} strokeWidth={1.5} aria-hidden />
      <p>{message}</p>
    </div>
  );
}
