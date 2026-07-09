"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { useChat } from "@/features/chat/useChat";
import { useAuth } from "@/features/auth/useAuth";
import { Spinner } from "@/components/common/Spinner";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { ChatMessageBubble } from "./ChatMessageBubble";
import styles from "./ChatWindow.module.css";

interface ChatWindowProps {
  peerId: string;
  peerUsername: string;
  onClose: () => void;
}

export function ChatWindow({ peerId, peerUsername, onClose }: ChatWindowProps) {
  const { user, refreshUser } = useAuth();
  const {
    messages,
    isConnecting,
    error,
    hasMoreHistory,
    loadMoreHistory,
    sendMessage,
    sendTransfer,
    acceptTransfer,
    rejectTransfer,
  } = useChat(peerId);
  const [draft, setDraft] = useState("");
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferAmount, setTransferAmount] = useState("");
  const [isSendingTransfer, setIsSendingTransfer] = useState(false);
  const [decidingMessageId, setDecidingMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    await sendMessage(content);
  }

  async function handleTransferSubmit(event: FormEvent) {
    event.preventDefault();
    const amount = Number(transferAmount);
    if (!Number.isInteger(amount) || amount <= 0) return;

    setIsSendingTransfer(true);
    try {
      await sendTransfer(amount);
      setTransferAmount("");
      setIsTransferOpen(false);
      await refreshUser();
    } catch {
      // sendTransfer already recorded the failure in `error` — keep the
      // form open so the user can see it and adjust the amount.
    } finally {
      setIsSendingTransfer(false);
    }
  }

  async function handleAccept(messageId: string) {
    setDecidingMessageId(messageId);
    try {
      await acceptTransfer(messageId);
      await refreshUser();
    } catch {
      // Error surfaced via the hook's `error` state already.
    } finally {
      setDecidingMessageId(null);
    }
  }

  async function handleReject(messageId: string) {
    setDecidingMessageId(messageId);
    try {
      await rejectTransfer(messageId);
    } catch {
      // Error surfaced via the hook's `error` state already.
    } finally {
      setDecidingMessageId(null);
    }
  }

  // Portal straight to <body>: this can be opened from inside any card that
  // happens to have `clip-path` (the shared `squircle` utility class, e.g.
  // the user profile page) — clip-path establishes a containing block for
  // `position: fixed` descendants same as transform/filter would, which
  // silently shrank this overlay down to that card's box instead of the
  // viewport. Escaping to `document.body` makes the overlay immune to
  // whatever ancestor it's opened from, now or in the future.
  return createPortal(
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span>{peerUsername}</span>
          <div className={styles.headerActions}>
            <button className={styles.transferToggle} onClick={() => setIsTransferOpen((prev) => !prev)}>
              💸 송금
            </button>
            <button className={styles.closeButton} onClick={onClose} aria-label="닫기">
              ×
            </button>
          </div>
        </div>

        <div className={styles.messages}>
          {hasMoreHistory && (
            <div className={styles.loadMoreWrap}>
              <button className={styles.loadMoreButton} onClick={loadMoreHistory}>
                이전 메시지 더 보기
              </button>
            </div>
          )}

          {isConnecting && <Spinner />}
          {!isConnecting && messages.length === 0 && <p className={styles.empty}>대화를 시작해보세요.</p>}

          {messages.map((message) => (
            <ChatMessageBubble
              key={message.id}
              message={message}
              isOwn={message.senderId === user?.id}
              onAccept={() => handleAccept(message.id)}
              onReject={() => handleReject(message.id)}
              isDeciding={decidingMessageId === message.id}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <ErrorMessage>{error}</ErrorMessage>

        {isTransferOpen && (
          <form className={styles.transferForm} onSubmit={handleTransferSubmit}>
            <input
              className={styles.transferInput}
              type="number"
              min={1}
              step={1}
              value={transferAmount}
              onChange={(e) => setTransferAmount(e.target.value)}
              placeholder={`보낼 금액 (내 잔액 ${(user?.balance ?? 0).toLocaleString()}원)`}
              autoFocus
            />
            <button type="submit" disabled={isSendingTransfer || !transferAmount}>
              {isSendingTransfer ? "보내는 중..." : "보내기"}
            </button>
          </form>
        )}

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="메시지를 입력하세요"
          />
          <button type="submit" disabled={!draft.trim()}>
            전송
          </button>
        </form>
      </div>
    </div>,
    document.body,
  );
}
