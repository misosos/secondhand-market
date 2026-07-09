import type { ChatMessageDto } from "@secondhand/types";
import styles from "./ChatMessageBubble.module.css";

interface ChatMessageBubbleProps {
  message: ChatMessageDto;
  isOwn: boolean;
  // DMs skip this: the peer's identity is already shown in the window
  // header, since there are only ever two participants. The global room
  // has many, so each bubble needs its own label.
  showSender?: boolean;
}

export function ChatMessageBubble({ message, isOwn, showSender }: ChatMessageBubbleProps) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isTransfer = message.type === "TRANSFER";

  return (
    <div className={`${styles.row} ${isOwn ? styles.own : ""}`}>
      {showSender && !isOwn && <span className={styles.sender}>{message.senderUsername}</span>}
      {isTransfer ? (
        <div className={styles.transferBubble}>
          <span className={styles.transferIcon}>💸</span>
          <span>{(message.amount ?? 0).toLocaleString()}원 {isOwn ? "보냄" : "받음"}</span>
        </div>
      ) : (
        <div className={styles.bubble}>{message.content}</div>
      )}
      <span className={styles.time}>{time}</span>
    </div>
  );
}
