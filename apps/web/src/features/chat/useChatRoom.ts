"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CHAT_EVENTS, type ChatMessageDto, type ChatRoomDto, type CursorPaginationResult } from "@secondhand/types";
import { connectSocket, emitWithAck } from "@/lib/socket";

const HISTORY_PAGE_SIZE = 30;

// Shared join+history+live-append plumbing behind both a 1:1 DM (useChat)
// and the single global room (useGlobalChat) — the only real difference
// between them is which socket event opens the room, so that's injected
// via `join`. `roomKey: null` means "don't join anything yet".
// `onTransferSettled` fires whenever a TRANSFER message's status changes
// (받기/거절 by either side) — used by useChat to refresh the caller's own
// balance, since accepting/rejecting can change it without this tab having
// initiated the action itself.
export function useChatRoom(
  roomKey: string | null,
  join: () => Promise<ChatRoomDto>,
  onTransferSettled?: () => void,
) {
  const [room, setRoom] = useState<ChatRoomDto | null>(null);
  const [messages, setMessages] = useState<ChatMessageDto[]>([]);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roomIdRef = useRef<string | null>(null);
  const cursorRef = useRef<string | null>(null);
  const joinRef = useRef(join);
  joinRef.current = join;
  const onTransferSettledRef = useRef(onTransferSettled);
  onTransferSettledRef.current = onTransferSettled;

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

    function handleMessageUpdated(message: ChatMessageDto) {
      if (message.roomId !== roomIdRef.current) return;
      setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
      onTransferSettledRef.current?.();
    }
    socket.on(CHAT_EVENTS.MESSAGE_UPDATED, handleMessageUpdated);

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
      socket.off(CHAT_EVENTS.MESSAGE_UPDATED, handleMessageUpdated);
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

  // Danggeun-Pay-style direct transfer — rejected server-side for the
  // global room (see ChatService.sendTransfer), so this is only meant to
  // be wired up from the 1:1 DM window.
  const sendTransfer = useCallback(async (amount: number) => {
    if (!roomIdRef.current) return;
    const socket = connectSocket();
    try {
      await emitWithAck(socket, CHAT_EVENTS.SEND_TRANSFER, { roomId: roomIdRef.current, amount });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send money");
      throw err;
    }
  }, []);

  // 받기/거절: the visible bubble update comes from the MESSAGE_UPDATED
  // broadcast (see handleMessageUpdated above), which the server sends to
  // every socket in the room including this one — these calls only need to
  // surface a rejection (e.g. someone else already settled it first).
  const acceptTransfer = useCallback(async (messageId: string) => {
    const socket = connectSocket();
    try {
      await emitWithAck(socket, CHAT_EVENTS.ACCEPT_TRANSFER, { messageId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to accept transfer");
      throw err;
    }
  }, []);

  const rejectTransfer = useCallback(async (messageId: string) => {
    const socket = connectSocket();
    try {
      await emitWithAck(socket, CHAT_EVENTS.REJECT_TRANSFER, { messageId });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject transfer");
      throw err;
    }
  }, []);

  return {
    room,
    messages,
    isConnecting,
    error,
    hasMoreHistory,
    loadMoreHistory,
    sendMessage,
    sendTransfer,
    acceptTransfer,
    rejectTransfer,
  };
}
