"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_EVENTS, type ChatMessageDto, type ChatRoomDto, type CursorPaginationResult } from "@secondhand/types";
import { connectSocket, emitWithAck } from "@/lib/socket";

const HISTORY_PAGE_SIZE = 30;

// Shared join+history+live-append plumbing behind both a 1:1 DM (useChat)
// and the single global room (useGlobalChat) — the only real difference
// between them is which socket event opens the room, so that's injected
// via `join`. `roomKey: null` means "don't join anything yet".
export function useChatRoom(roomKey: string | null, join: () => Promise<ChatRoomDto>) {
  const [room, setRoom] = useState<ChatRoomDto | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomIdRef = useRef<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const joinRef = useRef(join);
  joinRef.current = join;

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
    if (!roomKey) {
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
        const joinedRoom = await joinRef.current();
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
  }, [roomKey]);

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
      await emitWithAck(socket, CHAT_EVENTS.SEND_MESSAGE, { roomId: roomIdRef.current, content });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    }
  }, []);

  return { room, messages, isConnecting, error, hasMoreHistory, loadMoreHistory, sendMessage };
}
