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

export type ChatMessageType = "TEXT" | "TRANSFER";

export interface ChatMessageDto {
  id: string;
  roomId: string;
  senderId: string;
  senderUsername: string;
  content: string;
  type: ChatMessageType;
  // Set only when type is TRANSFER — the amount that moved from sender to
  // the room's other member.
  amount: number | null;
  createdAt: string;
}

export interface ChatHistoryQuery extends CursorPaginationQuery {
  roomId: string;
}

export interface SendMessagePayload {
  roomId: string;
  content: string;
}

// Danggeun-Pay-style "송금하기": sends money directly to whoever's on the
// other side of this DM room, independent of any product. Global room is
// not a valid target — see ChatService.sendTransfer.
export interface SendTransferPayload {
  roomId: string;
  amount: number;
}

// Socket.io event names shared between gateway (apps/api) and client (apps/web).
export const CHAT_EVENTS = {
  SEND_MESSAGE: "chat:send",
  SEND_TRANSFER: "chat:transfer",
  NEW_MESSAGE: "chat:new",
  JOIN_ROOM: "chat:join",
  JOIN_GLOBAL: "chat:joinGlobal",
  REQUEST_HISTORY: "chat:history",
  LIST_ROOMS: "chat:listRooms",
  ERROR: "chat:error",
} as const;
