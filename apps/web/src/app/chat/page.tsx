"use client";

import { useState } from "react";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { useAuth } from "@/features/auth/useAuth";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useChatRooms } from "@/features/chat/useChatRooms";
import { formatMessagePreview } from "@/lib/chatMessagePreview";
import styles from "./page.module.css";

export default function ChatListPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const { user } = useAuth();
  const { rooms, isLoading, error } = useChatRooms();
  const [activePeer, setActivePeer] = useState<{ id: string; username: string } | null>(null);

  if (authLoading) return <Spinner />;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>채팅</h1>

      <ErrorMessage>{error}</ErrorMessage>
      {isLoading && <Spinner />}
      {!isLoading && rooms.length === 0 && <p className={styles.empty}>아직 대화가 없습니다.</p>}

      <ul className={styles.list}>
        {rooms.map((room) => (
          <li key={room.id}>
            <button
              className={styles.roomButton}
              onClick={() => room.peer && setActivePeer(room.peer)}
              disabled={!room.peer}
            >
              <span className={styles.peerName}>{room.peer?.username ?? "알 수 없는 사용자"}</span>
              {room.lastMessage && (
                <span className={styles.preview}>
                  {formatMessagePreview(room.lastMessage, room.lastMessage.senderId === user?.id)}
                </span>
              )}
              {room.lastMessage && (
                <span className={styles.time}>{new Date(room.lastMessage.createdAt).toLocaleString()}</span>
              )}
            </button>
          </li>
        ))}
      </ul>

      {activePeer && (
        <ChatWindow peerId={activePeer.id} peerUsername={activePeer.username} onClose={() => setActivePeer(null)} />
      )}
    </div>
  );
}
