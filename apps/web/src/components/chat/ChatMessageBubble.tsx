import type { ChatMessageDto } from "@secondhand/types";
import styles from "./ChatMessageBubble.module.css";

interface ChatMessageBubbleProps {
  message: ChatMessageDto;
  isOwn: boolean;
  // DMs skip this: the peer's identity is already shown in the window
  // header, since there are only ever two participants. The global room
  // has many, so each bubble needs its own label.
  showSender?: boolean;
  // Only rendered for the recipient of a still-PENDING transfer.
  onAccept?: () => void;
  onReject?: () => void;
  isDeciding?: boolean;
}

export function ChatMessageBubble({ message, isOwn, showSender, onAccept, onReject, isDeciding }: ChatMessageBubbleProps) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isTransfer = message.type === "TRANSFER";
  const amountText = `${(message.amount ?? 0).toLocaleString()}원`;

  return (
    <div className={`${styles.row} ${isOwn ? styles.own : ""}`}>
      {showSender && !isOwn && <span className={styles.sender}>{message.senderUsername}</span>}
      {isTransfer ? (
        <div className={styles.transferBubble}>
          <span className={styles.transferIcon}>💸</span>
          {message.transactionStatus === "PENDING" && !isOwn ? (
            <div className={styles.transferDecision}>
              <span>{amountText}을 받으시겠어요?</span>
              <div className={styles.transferDecisionActions}>
                <button type="button" onClick={onAccept} disabled={isDeciding}>
                  받기
                </button>
                <button type="button" className={styles.transferRejectButton} onClick={onReject} disabled={isDeciding}>
                  거절
                </button>
              </div>
            </div>
          ) : message.transactionStatus === "PENDING" ? (
            <span>{amountText} 송금 대기중</span>
          ) : message.transactionStatus === "REJECTED" ? (
            <span>{amountText} {isOwn ? "거절되어 환불됨" : "거절함"}</span>
          ) : (
            <span>{amountText} {isOwn ? "보냄" : "받음"}</span>
          )}
        </div>
      ) : (
        <div className={styles.bubble}>{message.content}</div>
      )}
      <span className={styles.time}>{time}</span>
    </div>
  );
}
