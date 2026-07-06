"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_EVENTS, type ChatMessageDto, type ChatRoomDto, type CursorPaginationResult } from "@secondhand/types";
import { connectSocket, emitWithAck } from "@/lib/socket";
import { useAuth } from "@/features/auth/useAuth";

const HISTORY_PAGE_SIZE = 30;

// Opens (or reuses) a 1:1 DM with `peerId` and keeps `messages` in sync via
// the room's Socket.io broadcast. `peerId: null` means "no chat open".
export function useChat(peerId: string | null) {
  const { user } = useAuth();
  const [room, setRoom] = useState<ChatRoomDto | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomIdRef = useRef<string | null>(null);
  const cursorRef = useRef<string | null>(null);

  // Every exception the gateway throws for this socket arrives on this one
  // event, not correlated to which call caused it (see lib/socket.ts) — we
  // can only surface it as "something about the last chat action failed".
  useEffect(() => {
    const socket = connectSocket();
    function handleException(payload: { message?: string | string[] } | string[]) {
      const raw = Array.isArray(payload) ? payload : payload?.message;
      setError(Array.isArray(raw) ? raw.join(", ") : (raw ?? "Chat error"));
    }
    socket.on(CHAT_EVENTS.ERROR, handleException);
    socket.on("exception", handleException);
    return () => {
      socket.off(CHAT_EVENTS.ERROR, handleException);
      socket.off("exception", handleException);
    };
  }, []);

  useEffect(() => {
    if (!peerId || !user) {
      setRoom(null);
      setMessages([]);
      roomIdRef.current = null;
      return;
    }

    let active = true;
    setIsConnecting(true);
    setError(null);
    setMessages([]);
    roomIdRef.current = null;

    const socket = connectSocket();

    function handleNewMessage(message: ChatMessageDto) {
      if (message.roomId === roomIdRef.current) {
        setMessages((prev) => [...prev, message]);
      }
    }
    socket.on(CHAT_EVENTS.NEW_MESSAGE, handleNewMessage);

    (async () => {
      try {
        const joinedRoom = await emitWithAck<ChatRoomDto>(socket, CHAT_EVENTS.JOIN_ROOM, { peerId });
        if (!active) return;
        roomIdRef.current = joinedRoom.id;
        setRoom(joinedRoom);

        const history = await emitWithAck<CursorPaginationResult<ChatMessageDto>>(socket, CHAT_EVENTS.REQUEST_HISTORY, {
          roomId: joinedRoom.id,
          limit: HISTORY_PAGE_SIZE,
        });
        if (!active) return;
        // History arrives newest-first; the message list renders oldest-first.
        setMessages([...history.items].reverse());
        cursorRef.current = history.nextCursor;
        setHasMoreHistory(history.nextCursor !== null);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Failed to open chat");
      } finally {
        if (active) setIsConnecting(false);
      }
    })();

    return () => {
      active = false;
      socket.off(CHAT_EVENTS.NEW_MESSAGE, handleNewMessage);
    };
  }, [peerId, user]);

  const loadMoreHistory = useCallback(async () => {
    if (!roomIdRef.current || !cursorRef.current) return;
    const socket = connectSocket();
    try {
      const history = await emitWithAck<CursorPaginationResult<ChatMessageDto>>(socket, CHAT_EVENTS.REQUEST_HISTORY, {
        roomId: roomIdRef.current,
        cursor: cursorRef.current,
        limit: HISTORY_PAGE_SIZE,
      });
      setMessages((prev) => [...[...history.items].reverse(), ...prev]);
      cursorRef.current = history.nextCursor;
      setHasMoreHistory(history.nextCursor !== null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load older messages");
    }
  }, []);

  const sendMessage = useCallback(async (content: string) => {
    if (!roomIdRef.current) return;
    const socket = connectSocket();
    try {
      // No optimistic local append: the server broadcasts chat:new back to
      // every room member including the sender, so the listener above
      // appends it once — a single source of truth instead of a
      // client-side guess that could desync from what was actually stored.
      await emitWithAck(socket, CHAT_EVENTS.SEND_MESSAGE, { roomId: roomIdRef.current, content });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  }, []);

  return { room, messages, isConnecting, error, hasMoreHistory, loadMoreHistory, sendMessage };
}
