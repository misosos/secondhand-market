import type { ChatMessageDto } from "@secondhand/types";
import styles from "./ChatMessageBubble.module.css";

export function ChatMessageBubble({ message, isOwn }: { message: ChatMessageDto; isOwn: boolean }) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  return (
    <div className={`${styles.row} ${isOwn ? styles.own : ""}`}>
      <div className={styles.bubble}>{message.content}</div>
      <span className={styles.time}>{time}</span>
    </div>
  );
}
