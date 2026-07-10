"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChevronUp, MessagesSquare, Send } from "lucide-react";
import { ChatMessageBubble } from "@/components/chat/ChatMessageBubble";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { useAuth } from "@/features/auth/useAuth";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useGlobalChat } from "@/features/chat/useGlobalChat";
import styles from "./page.module.css";

export default function GlobalChatPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const { user } = useAuth();
  const { messages, isConnecting, error, hasMoreHistory, loadMoreHistory, sendMessage } = useGlobalChat();
  const [draft, setDraft] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  if (authLoading) return <Spinner />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const content = draft.trim();
    if (!content) return;
    setDraft("");
    await sendMessage(content);
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 12 }}>전체 채팅</h1>

      <div className={styles.panel}>
        <div className={styles.messages}>
          {hasMoreHistory && (
            <div className={styles.loadMoreWrap}>
              <button className={styles.loadMoreButton} onClick={loadMoreHistory}>
                <ChevronUp size={14} strokeWidth={2.25} aria-hidden />
                이전 메시지 더 보기
              </button>
            </div>
          )}

          {isConnecting && <Spinner />}
          {!isConnecting && messages.length === 0 && (
            <EmptyState icon={MessagesSquare} message="대화를 시작해보세요." />
          )}

          {messages.map((message) => (
            <ChatMessageBubble key={message.id} message={message} isOwn={message.senderId === user?.id} showSender />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <ErrorMessage>{error}</ErrorMessage>

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="전체 채팅에 메시지를 입력하세요"
          />
          <Button type="submit" icon={Send} disabled={!draft.trim()}>
            전송
          </Button>
        </form>
      </div>
    </div>
  );
}
