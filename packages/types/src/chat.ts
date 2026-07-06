import { CursorPaginationQuery } from "./pagination";

export interface ChatRoomDto {
  id: string;
  isGlobal: boolean;
  peer?: {
    id: string;
    username: string;
  };
  lastMessage?: ChatMessageDto;
}

export interface ChatMessageDto {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

export interface ChatHistoryQuery extends CursorPaginationQuery {
  roomId: string;
}

export interface SendMessagePayload {
  roomId: string;
  content: string;
}

// Socket.io event names shared between gateway (apps/api) and client (apps/web).
export const CHAT_EVENTS = {
  SEND_MESSAGE: "chat:send",
  NEW_MESSAGE: "chat:new",
  JOIN_ROOM: "chat:join",
  REQUEST_HISTORY: "chat:history",
  LIST_ROOMS: "chat:listRooms",
  ERROR: "chat:error",
} as const;
