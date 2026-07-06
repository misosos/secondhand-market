import { Test } from "@nestjs/testing";
import { WsException } from "@nestjs/websockets";
import { AccountStatus } from "@prisma/client";
import { ChatService } from "./chat.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { RedisService } from "../../infra/redis/redis.service";
import { UserService } from "../user/user.service";
import { CHAT_RATE_LIMIT_PER_WINDOW } from "./chat.constants";

describe("ChatService", () => {
  let service: ChatService;
  let prisma: {
    $transaction: jest.Mock;
    chatMember: { findUnique: jest.Mock };
    chatMessage: { create: jest.Mock; findMany: jest.Mock };
    chatRoom: { findMany: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let tx: { $executeRaw: jest.Mock; chatRoom: { findFirst: jest.Mock; create: jest.Mock } };
  let redisClient: { incr: jest.Mock; pexpire: jest.Mock };
  let userService: { findActiveById: jest.Mock };

  const activeUser = (id: string) => ({ id, username: id, status: AccountStatus.ACTIVE });

  beforeEach(async () => {
    tx = {
      $executeRaw: jest.fn(),
      chatRoom: { findFirst: jest.fn(), create: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
      chatMember: { findUnique: jest.fn() },
      chatMessage: { create: jest.fn(), findMany: jest.fn() },
      chatRoom: { findMany: jest.fn() },
      user: { findMany: jest.fn() },
    };
    redisClient = { incr: jest.fn(), pexpire: jest.fn() };
    userService = { findActiveById: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { client: redisClient } },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get(ChatService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("getOrCreateDmRoom", () => {
    it("rejects chatting with yourself", async () => {
      await expect(service.getOrCreateDmRoom("u1", "u1")).rejects.toThrow(WsException);
    });

    it("rejects when the caller's own account is gone/dormant", async () => {
      userService.findActiveById.mockResolvedValueOnce(null);
      await expect(service.getOrCreateDmRoom("u1", "u2")).rejects.toThrow(WsException);
    });

    it("rejects when the peer does not exist", async () => {
      userService.findActiveById.mockResolvedValueOnce(activeUser("u1")).mockResolvedValueOnce(null);
      await expect(service.getOrCreateDmRoom("u1", "u2")).rejects.toThrow(WsException);
    });

    it("rejects chatting with a dormant peer", async () => {
      userService.findActiveById
        .mockResolvedValueOnce(activeUser("u1"))
        .mockResolvedValueOnce({ id: "u2", username: "u2", status: AccountStatus.DORMANT });

      await expect(service.getOrCreateDmRoom("u1", "u2")).rejects.toThrow(WsException);
    });

    it("reuses an existing room instead of creating a duplicate", async () => {
      userService.findActiveById.mockResolvedValueOnce(activeUser("u1")).mockResolvedValueOnce(activeUser("u2"));
      tx.chatRoom.findFirst.mockResolvedValue({ id: "existing-room" });

      const room = await service.getOrCreateDmRoom("u1", "u2");

      expect(room.id).toBe("existing-room");
      expect(tx.chatRoom.create).not.toHaveBeenCalled();
    });

    it("creates a new room when the pair has never talked before", async () => {
      userService.findActiveById.mockResolvedValueOnce(activeUser("u1")).mockResolvedValueOnce(activeUser("u2"));
      tx.chatRoom.findFirst.mockResolvedValue(null);
      tx.chatRoom.create.mockResolvedValue({ id: "new-room" });

      const room = await service.getOrCreateDmRoom("u1", "u2");

      expect(room.id).toBe("new-room");
      expect(room.peer).toEqual({ id: "u2", username: "u2" });
      // Serializes concurrent first-contact attempts for this pair.
      expect(tx.$executeRaw).toHaveBeenCalled();
    });
  });

  describe("sendMessage", () => {
    beforeEach(() => {
      userService.findActiveById.mockResolvedValue(activeUser("u1"));
    });

    it("rejects a dormant sender before even checking membership", async () => {
      userService.findActiveById.mockResolvedValue({ id: "u1", username: "u1", status: AccountStatus.DORMANT });

      await expect(service.sendMessage("u1", "room-1", "hi")).rejects.toThrow(WsException);
      expect(prisma.chatMember.findUnique).not.toHaveBeenCalled();
    });

    it("rejects a sender who isn't a member of the room", async () => {
      prisma.chatMember.findUnique.mockResolvedValue(null);
      await expect(service.sendMessage("u1", "room-1", "hi")).rejects.toThrow(WsException);
    });

    it("persists and returns the message when everything checks out", async () => {
      prisma.chatMember.findUnique.mockResolvedValue({ roomId: "room-1", userId: "u1" });
      redisClient.incr.mockResolvedValue(1);
      prisma.chatMessage.create.mockResolvedValue({
        id: "m1",
        roomId: "room-1",
        senderId: "u1",
        content: "hi",
        createdAt: new Date(),
      });

      const message = await service.sendMessage("u1", "room-1", "hi");
      expect(message).toMatchObject({ id: "m1", roomId: "room-1", senderId: "u1", content: "hi" });
    });

    it(`rejects the ${CHAT_RATE_LIMIT_PER_WINDOW + 1}th message within the same window`, async () => {
      prisma.chatMember.findUnique.mockResolvedValue({ roomId: "room-1", userId: "u1" });
      prisma.chatMessage.create.mockResolvedValue({
        id: "m",
        roomId: "room-1",
        senderId: "u1",
        content: "hi",
        createdAt: new Date(),
      });

      for (let i = 1; i <= CHAT_RATE_LIMIT_PER_WINDOW; i++) {
        redisClient.incr.mockResolvedValueOnce(i);
        await expect(service.sendMessage("u1", "room-1", "hi")).resolves.toBeDefined();
      }

      redisClient.incr.mockResolvedValueOnce(CHAT_RATE_LIMIT_PER_WINDOW + 1);
      await expect(service.sendMessage("u1", "room-1", "hi")).rejects.toThrow(WsException);
    });
  });

  describe("getHistory", () => {
    beforeEach(() => {
      userService.findActiveById.mockResolvedValue(activeUser("u1"));
      prisma.chatMember.findUnique.mockResolvedValue({ roomId: "room-1", userId: "u1" });
    });

    it("rejects a non-member from reading history", async () => {
      prisma.chatMember.findUnique.mockResolvedValue(null);
      await expect(service.getHistory("u1", { roomId: "room-1" })).rejects.toThrow(WsException);
    });

    it("reports no next page when fewer rows than the limit come back", async () => {
      prisma.chatMessage.findMany.mockResolvedValue([
        { id: "m1", roomId: "room-1", senderId: "u1", content: "hi", createdAt: new Date() },
      ]);

      const result = await service.getHistory("u1", { roomId: "room-1", limit: 30 });
      expect(result.nextCursor).toBeNull();
      expect(result.items).toHaveLength(1);
    });

    it("trims the extra lookahead row and sets nextCursor when more history exists", async () => {
      const rows = Array.from({ length: 4 }, (_, i) => ({
        id: `m${i}`,
        roomId: "room-1",
        senderId: "u1",
        content: `msg ${i}`,
        createdAt: new Date(Date.now() - i * 1000),
      }));
      prisma.chatMessage.findMany.mockResolvedValue(rows); // 4 rows, limit 3 => hasNext

      const result = await service.getHistory("u1", { roomId: "room-1", limit: 3 });

      expect(result.items).toHaveLength(3);
      expect(result.nextCursor).not.toBeNull();
    });
  });

  describe("listRooms", () => {
    it("orders rooms by last message time, newest first, falling back to room creation time", async () => {
      const older = new Date("2026-01-01T00:00:00Z");
      const newer = new Date("2026-01-02T00:00:00Z");
      const newest = new Date("2026-01-03T00:00:00Z");

      prisma.chatRoom.findMany.mockResolvedValue([
        {
          id: "room-old",
          isGlobal: false,
          createdAt: older,
          members: [{ roomId: "room-old", userId: "u1" }, { roomId: "room-old", userId: "u2" }],
          messages: [{ id: "m1", roomId: "room-old", senderId: "u2", content: "hi", createdAt: older }],
        },
        {
          id: "room-new",
          isGlobal: false,
          createdAt: newer,
          members: [{ roomId: "room-new", userId: "u1" }, { roomId: "room-new", userId: "u3" }],
          messages: [{ id: "m2", roomId: "room-new", senderId: "u3", content: "hey", createdAt: newer }],
        },
        {
          id: "room-empty",
          isGlobal: false,
          createdAt: newest,
          members: [{ roomId: "room-empty", userId: "u1" }, { roomId: "room-empty", userId: "u4" }],
          messages: [],
        },
      ]);
      prisma.user.findMany.mockResolvedValue([
        { id: "u2", username: "u2" },
        { id: "u3", username: "u3" },
        { id: "u4", username: "u4" },
      ]);

      const rooms = await service.listRooms("u1");

      expect(rooms.map((r) => r.id)).toEqual(["room-empty", "room-new", "room-old"]);
      expect(rooms[1].peer).toEqual({ id: "u3", username: "u3" });
      expect(rooms[1].lastMessage).toMatchObject({ id: "m2", content: "hey" });
      expect(rooms[0].lastMessage).toBeUndefined();
    });
  });
});
