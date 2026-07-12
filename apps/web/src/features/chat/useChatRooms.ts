"use client";

import { useCallback, useEffect, useState } from "react";
import { CHAT_EVENTS, type ChatRoomDto } from "@secondhand/types";
import { connectSocket, emitWithAck } from "@/lib/socket";
import { useAuth } from "@/features/auth/useAuth";

// Lists the current user's DM rooms (most recently active first).
export function useChatRooms() {
  const { user } = useAuth();
  const [rooms, setRooms] = useState<ChatRoomDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setRooms([]);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const socket = connectSocket();
      const result = await emitWithAck<ChatRoomDto[]>(socket, CHAT_EVENTS.LIST_ROOMS, {});
      setRooms(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "채팅 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Refreshes the preview/ordering when a message arrives — or an existing
  // one's status changes, e.g. a transfer being 받기/거절'd — in whichever
  // room is currently open (the gateway only broadcasts to sockets that
  // have chat:join'd that room, so this doesn't cover rooms not open here).
  useEffect(() => {
    if (!user) return;
    const socket = connectSocket();
    socket.on(CHAT_EVENTS.NEW_MESSAGE, refresh);
    socket.on(CHAT_EVENTS.MESSAGE_UPDATED, refresh);
    return () => {
      socket.off(CHAT_EVENTS.NEW_MESSAGE, refresh);
      socket.off(CHAT_EVENTS.MESSAGE_UPDATED, refresh);
    };
  }, [user, refresh]);

  return { rooms, isLoading, error, refresh };
}
