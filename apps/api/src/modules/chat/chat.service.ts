import { Injectable } from "@nestjs/common";
import { WsException } from "@nestjs/websockets";
import { AccountStatus, ChatMessage, ChatRoom } from "@prisma/client";
import type { ChatHistoryQuery, ChatMessageDto, ChatRoomDto, CursorPaginationResult } from "@secondhand/types";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { RedisService } from "../../infra/redis/redis.service";
import { UserService } from "../user/user.service";
import { CHAT_HISTORY_DEFAULT_PAGE_SIZE, CHAT_HISTORY_MAX_PAGE_SIZE, CHAT_RATE_LIMIT_PER_WINDOW, CHAT_RATE_LIMIT_WINDOW_MS } from "./chat.constants";
import { buildSeekWhere, decodeCursor, encodeCursor } from "./chat.pagination";

@Injectable()
export class ChatService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redisService: RedisService,
    private readonly userService: UserService,
  ) {}

  async getOrCreateDmRoom(userId: string, peerId: string): Promise<ChatRoomDto> {
    if (userId === peerId) {
      throw new WsException("Cannot start a chat with yourself");
    }

    await this.assertActive(userId);
    const peer = await this.userService.findActiveById(peerId);
    if (!peer) throw new WsException("User not found");
    if (peer.status === AccountStatus.DORMANT) {
      throw new WsException("Cannot chat with a dormant account");
    }

    const [first, second] = [userId, peerId].sort();

    const roomId = await this.prisma.$transaction(async (tx) => {
      // This schema has no unique constraint on a (userA, userB) member
      // pair, so a Postgres advisory lock keyed by the sorted pair
      // serializes concurrent "first contact" requests between the same
      // two users. Without it, two simultaneous join attempts could each
      // miss the other's not-yet-committed room and create two DMs.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${first}), hashtext(${second}))`;

      const existing = await tx.chatRoom.findFirst({
        where: {
          isGlobal: false,
          AND: [{ members: { some: { userId: first } } }, { members: { some: { userId: second } } }],
        },
      });
      if (existing) return existing.id;

      const created = await tx.chatRoom.create({
        data: {
          isGlobal: false,
          members: { create: [{ userId: first }, { userId: second }] },
        },
      });
      return created.id;
    });

    return {
      id: roomId,
      isGlobal: false,
      peer: { id: peer.id, username: peer.username },
    };
  }

  async sendMessage(senderId: string, roomId: string, content: string): Promise<ChatMessageDto> {
    await this.assertActive(senderId);
    const room = await this.getRoomOrThrow(roomId);
    // The global room has no ChatMember rows — everyone active is
    // implicitly a member — so membership only gets enforced for DMs.
    if (!room.isGlobal) {
      await this.assertMember(roomId, senderId);
    }
    await this.assertNotRateLimited(senderId);

    const message = await this.prisma.chatMessage.create({
      data: { roomId, senderId, content },
      include: { sender: true },
    });

    return this.toMessageDto(message);
  }

  async getGlobalRoom(userId: string): Promise<ChatRoomDto> {
    await this.assertActive(userId);
    const room = await this.prisma.chatRoom.findFirst({ where: { isGlobal: true } });
    if (!room) throw new WsException("Global room is not configured");
    return { id: room.id, isGlobal: true };
  }

  async listRooms(userId: string): Promise<ChatRoomDto[]> {
    const rooms = await this.prisma.chatRoom.findMany({
      where: { isGlobal: false, members: { some: { userId } } },
      include: {
        members: true,
        messages: { orderBy: { createdAt: "desc" }, take: 1, include: { sender: true } },
      },
    });

    // ChatMember has no `user` relation (see schema), so peer usernames
    // have to be resolved via a separate batched lookup rather than an
    // include.
    const peerIds = rooms
      .map((room) => room.members.find((member) => member.userId !== userId)?.userId)
      .filter((id): id is string => !!id);
    const peers = await this.prisma.user.findMany({ where: { id: { in: peerIds } } });
    const peerById = new Map(peers.map((peer) => [peer.id, peer]));

    return rooms
      .map((room) => {
        const peerId = room.members.find((member) => member.userId !== userId)?.userId;
        const peer = peerId ? peerById.get(peerId) : undefined;
        const [lastMessage] = room.messages;
        return {
          dto: {
            id: room.id,
            isGlobal: room.isGlobal,
            peer: peer ? { id: peer.id, username: peer.username } : undefined,
            lastMessage: lastMessage ? this.toMessageDto(lastMessage) : undefined,
          },
          // Most recently active conversation first; rooms with no
          // messages yet fall back to room creation time.
          sortKey: (lastMessage?.createdAt ?? room.createdAt).getTime(),
        };
      })
      .sort((a, b) => b.sortKey - a.sortKey)
      .map(({ dto }) => dto);
  }

  async getHistory(userId: string, query: ChatHistoryQuery): Promise<CursorPaginationResult<ChatMessageDto>> {
    await this.assertActive(userId);
    const room = await this.getRoomOrThrow(query.roomId);
    if (!room.isGlobal) {
      await this.assertMember(query.roomId, userId);
    }

    const limit = Math.min(query.limit ?? CHAT_HISTORY_DEFAULT_PAGE_SIZE, CHAT_HISTORY_MAX_PAGE_SIZE);

    const rows = await this.prisma.chatMessage.findMany({
      where: {
        roomId: query.roomId,
        ...(query.cursor ? buildSeekWhere(decodeCursor(query.cursor)) : {}),
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: limit + 1,
      include: { sender: true },
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;

    return {
      items: items.map((m) => this.toMessageDto(m)),
      nextCursor: hasNext ? encodeCursor(items[items.length - 1]) : null,
    };
  }

  private async assertActive(userId: string): Promise<void> {
    const user = await this.userService.findActiveById(userId);
    if (!user) throw new WsException("User not found");
    if (user.status === AccountStatus.DORMANT) {
      throw new WsException("Dormant accounts cannot use chat");
    }
  }

  private async getRoomOrThrow(roomId: string): Promise<ChatRoom> {
    const room = await this.prisma.chatRoom.findUnique({ where: { id: roomId } });
    if (!room) throw new WsException("Room not found");
    return room;
  }

  private async assertMember(roomId: string, userId: string): Promise<void> {
    const membership = await this.prisma.chatMember.findUnique({
      where: { roomId_userId: { roomId, userId } },
    });
    if (!membership) throw new WsException("Not a member of this room");
  }

  private async assertNotRateLimited(userId: string): Promise<void> {
    const key = `chat:ratelimit:${userId}`;
    const count = await this.redisService.client.incr(key);
    if (count === 1) {
      await this.redisService.client.pexpire(key, CHAT_RATE_LIMIT_WINDOW_MS);
    }
    if (count > CHAT_RATE_LIMIT_PER_WINDOW) {
      throw new WsException(
        `Rate limit exceeded: max ${CHAT_RATE_LIMIT_PER_WINDOW} messages per ${CHAT_RATE_LIMIT_WINDOW_MS}ms`,
      );
    }
  }

  private toMessageDto(message: ChatMessage & { sender: { username: string } }): ChatMessageDto {
    return {
      id: message.id,
      roomId: message.roomId,
      senderId: message.senderId,
      senderUsername: message.sender.username,
      content: message.content,
      createdAt: message.createdAt.toISOString(),
    };
  }
}
