import styles from "./ErrorMessage.module.css";

export function ErrorMessage({ children }: { children: string | null | undefined }) {
  if (!children) return null;
  return <p className={styles.error}>{children}</p>;
}
