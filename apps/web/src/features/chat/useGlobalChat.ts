"use client";

import { useCallback } from "react";
import { CHAT_EVENTS, type ChatRoomDto } from "@secondhand/types";
import { connectSocket, emitWithAck } from "@/lib/socket";
import { useAuth } from "@/features/auth/useAuth";
import { useChatRoom } from "./useChatRoom";

// Joins the single seeded global room that every active user shares.
export function useGlobalChat() {
  const { user } = useAuth();

  const join = useCallback(() => {
    const socket = connectSocket();
    return emitWithAck<ChatRoomDto>(socket, CHAT_EVENTS.JOIN_GLOBAL, {});
  }, []);

  return useChatRoom(user ? "global" : null, join);
}
