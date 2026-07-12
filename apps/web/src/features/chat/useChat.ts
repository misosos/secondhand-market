"use client";

import { useCallback } from "react";
import { CHAT_EVENTS, type ChatRoomDto } from "@secondhand/types";
import { connectSocket, emitWithAck } from "@/lib/socket";
import { useAuth } from "@/features/auth/useAuth";
import { useChatRoom } from "./useChatRoom";

// Opens (or reuses) a 1:1 DM with `peerId` and keeps `messages` in sync via
// the room's Socket.io broadcast. `peerId: null` means "no chat open".
export function useChat(peerId: string | null) {
  const { user, refreshUser } = useAuth();

  const join = useCallback(() => {
    const socket = connectSocket();
    return emitWithAck<ChatRoomDto>(socket, CHAT_EVENTS.JOIN_ROOM, { peerId });
  }, [peerId]);

  // A transfer settling (받기/거절, by either side) can change this user's
  // balance without this tab having initiated it — refetch to stay accurate.
  return useChatRoom(user && peerId ? peerId : null, join, refreshUser);
}
