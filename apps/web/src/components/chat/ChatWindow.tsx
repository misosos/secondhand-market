"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
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
  const { user } = useAuth();
  const { messages, isConnecting, error, hasMoreHistory, loadMoreHistory, sendMessage } = useChat(peerId);
  const [draft, setDraft] = useState("");
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

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <div className={styles.header}>
          <span>{peerUsername}</span>
          <button className={styles.closeButton} onClick={onClose} aria-label="닫기">
            ×
          </button>
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
            <ChatMessageBubble key={message.id} message={message} isOwn={message.senderId === user?.id} />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <ErrorMessage>{error}</ErrorMessage>

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
    </div>
  );
}
