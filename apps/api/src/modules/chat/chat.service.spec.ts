import { Test } from "@nestjs/testing";
import { WsException } from "@nestjs/websockets";
import { AccountStatus } from "@prisma/client";
import { ChatService } from "./chat.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { RedisService } from "../../infra/redis/redis.service";
import { UserService } from "../user/user.service";
import { TransactionService } from "../transaction/transaction.service";
import { CHAT_RATE_LIMIT_PER_WINDOW } from "./chat.constants";

describe("ChatService", () => {
  let service: ChatService;
  let prisma: {
    $transaction: jest.Mock;
    chatMember: { findUnique: jest.Mock; findFirst: jest.Mock };
    chatMessage: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; findUniqueOrThrow: jest.Mock };
    chatRoom: { findMany: jest.Mock; findUnique: jest.Mock; findFirst: jest.Mock };
    user: { findMany: jest.Mock };
  };
  let tx: { $executeRaw: jest.Mock; chatRoom: { findFirst: jest.Mock; create: jest.Mock } };
  let redisClient: { incr: jest.Mock; pexpire: jest.Mock };
  let userService: { findActiveById: jest.Mock };
  let transactionService: { initiateTransfer: jest.Mock; acceptTransfer: jest.Mock; rejectTransfer: jest.Mock };

  const activeUser = (id: string) => ({ id, username: id, status: AccountStatus.ACTIVE });

  beforeEach(async () => {
    tx = {
      $executeRaw: jest.fn(),
      chatRoom: { findFirst: jest.fn(), create: jest.fn() },
    };
    prisma = {
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
      chatMember: { findUnique: jest.fn(), findFirst: jest.fn() },
      chatMessage: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), findUniqueOrThrow: jest.fn() },
      chatRoom: { findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn() },
      user: { findMany: jest.fn() },
    };
    redisClient = { incr: jest.fn(), pexpire: jest.fn() };
    userService = { findActiveById: jest.fn() };
    transactionService = { initiateTransfer: jest.fn(), acceptTransfer: jest.fn(), rejectTransfer: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ChatService,
        { provide: PrismaService, useValue: prisma },
        { provide: RedisService, useValue: { client: redisClient } },
        { provide: UserService, useValue: userService },
        { provide: TransactionService, useValue: transactionService },
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
      prisma.chatRoom.findUnique.mockResolvedValue({ id: "room-1", isGlobal: false });
    });

    it("rejects a dormant sender before even checking membership", async () => {
      userService.findActiveById.mockResolvedValue({ id: "u1", username: "u1", status: AccountStatus.DORMANT });

      await expect(service.sendMessage("u1", "room-1", "hi")).rejects.toThrow(WsException);
      expect(prisma.chatMember.findUnique).not.toHaveBeenCalled();
    });

    it("rejects when the room doesn't exist", async () => {
      prisma.chatRoom.findUnique.mockResolvedValue(null);
      await expect(service.sendMessage("u1", "missing-room", "hi")).rejects.toThrow(WsException);
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
        sender: { username: "u1" },
      });

      const message = await service.sendMessage("u1", "room-1", "hi");
      expect(message).toMatchObject({ id: "m1", roomId: "room-1", senderId: "u1", senderUsername: "u1", content: "hi" });
    });

    it("skips the membership check for the global room", async () => {
      prisma.chatRoom.findUnique.mockResolvedValue({ id: "global-room", isGlobal: true });
      redisClient.incr.mockResolvedValue(1);
      prisma.chatMessage.create.mockResolvedValue({
        id: "m1",
        roomId: "global-room",
        senderId: "u1",
        content: "hi all",
        createdAt: new Date(),
        sender: { username: "u1" },
      });

      await expect(service.sendMessage("u1", "global-room", "hi all")).resolves.toBeDefined();
      expect(prisma.chatMember.findUnique).not.toHaveBeenCalled();
    });

    it(`rejects the ${CHAT_RATE_LIMIT_PER_WINDOW + 1}th message within the same window`, async () => {
      prisma.chatMember.findUnique.mockResolvedValue({ roomId: "room-1", userId: "u1" });
      prisma.chatMessage.create.mockResolvedValue({
        id: "m",
        roomId: "room-1",
        senderId: "u1",
        content: "hi",
        createdAt: new Date(),
        sender: { username: "u1" },
      });

      for (let i = 1; i <= CHAT_RATE_LIMIT_PER_WINDOW; i++) {
        redisClient.incr.mockResolvedValueOnce(i);
        await expect(service.sendMessage("u1", "room-1", "hi")).resolves.toBeDefined();
      }

      redisClient.incr.mockResolvedValueOnce(CHAT_RATE_LIMIT_PER_WINDOW + 1);
      await expect(service.sendMessage("u1", "room-1", "hi")).rejects.toThrow(WsException);
    });
  });

  describe("sendTransfer", () => {
    beforeEach(() => {
      userService.findActiveById.mockResolvedValue(activeUser("u1"));
      prisma.chatRoom.findUnique.mockResolvedValue({ id: "room-1", isGlobal: false });
      prisma.chatMember.findUnique.mockResolvedValue({ roomId: "room-1", userId: "u1" });
      redisClient.incr.mockResolvedValue(1);
    });

    it("rejects sending money in the global room", async () => {
      prisma.chatRoom.findUnique.mockResolvedValue({ id: "global-room", isGlobal: true });
      await expect(service.sendTransfer("u1", "global-room", 1000)).rejects.toThrow(WsException);
      expect(transactionService.initiateTransfer).not.toHaveBeenCalled();
    });

    it("rejects a sender who isn't a member of the room", async () => {
      prisma.chatMember.findUnique.mockResolvedValue(null);
      await expect(service.sendTransfer("u1", "room-1", 1000)).rejects.toThrow(WsException);
      expect(transactionService.initiateTransfer).not.toHaveBeenCalled();
    });

    it("rejects when the room unexpectedly has no other member", async () => {
      prisma.chatMember.findFirst.mockResolvedValue(null);
      await expect(service.sendTransfer("u1", "room-1", 1000)).rejects.toThrow(WsException);
      expect(transactionService.initiateTransfer).not.toHaveBeenCalled();
    });

    it("propagates TransactionService's own rejection (e.g. insufficient balance) without creating a message", async () => {
      prisma.chatMember.findFirst.mockResolvedValue({ roomId: "room-1", userId: "u2" });
      transactionService.initiateTransfer.mockRejectedValue(new Error("Insufficient balance"));

      await expect(service.sendTransfer("u1", "room-1", 1000)).rejects.toThrow("Insufficient balance");
      expect(prisma.chatMessage.create).not.toHaveBeenCalled();
    });

    it("debits via TransactionService.initiateTransfer, then records a PENDING TRANSFER message", async () => {
      prisma.chatMember.findFirst.mockResolvedValue({ roomId: "room-1", userId: "u2" });
      transactionService.initiateTransfer.mockResolvedValue({ id: "txn-1", amount: 5000 });
      prisma.chatMessage.create.mockResolvedValue({
        id: "m1",
        roomId: "room-1",
        senderId: "u1",
        content: "5,000원을 보냈습니다",
        type: "TRANSFER",
        amount: 5000,
        createdAt: new Date(),
        sender: { username: "u1" },
        transaction: { status: "PENDING" },
      });

      const message = await service.sendTransfer("u1", "room-1", 5000);

      expect(transactionService.initiateTransfer).toHaveBeenCalledWith("u1", "u2", 5000);
      expect(prisma.chatMessage.create).toHaveBeenCalledWith({
        data: {
          roomId: "room-1",
          senderId: "u1",
          type: "TRANSFER",
          amount: 5000,
          transactionId: "txn-1",
          content: "5,000원을 보냈습니다",
        },
        include: { sender: true, transaction: true },
      });
      expect(message).toMatchObject({ id: "m1", type: "TRANSFER", amount: 5000, transactionStatus: "PENDING" });
    });
  });

  describe("acceptTransfer", () => {
    const pendingMessage = {
      id: "m1",
      roomId: "room-1",
      senderId: "u1",
      type: "TRANSFER",
      transactionId: "txn-1",
    };

    beforeEach(() => {
      userService.findActiveById.mockResolvedValue(activeUser("u2"));
    });

    it("rejects a dormant/gone caller before ever loading the message", async () => {
      userService.findActiveById.mockResolvedValue(null);
      await expect(service.acceptTransfer("u2", "m1")).rejects.toThrow(WsException);
      expect(prisma.chatMessage.findUnique).not.toHaveBeenCalled();
      expect(transactionService.acceptTransfer).not.toHaveBeenCalled();
    });

    it("rejects when the message doesn't exist", async () => {
      prisma.chatMessage.findUnique.mockResolvedValue(null);
      await expect(service.acceptTransfer("u2", "m1")).rejects.toThrow(WsException);
      expect(transactionService.acceptTransfer).not.toHaveBeenCalled();
    });

    it("rejects a non-transfer message", async () => {
      prisma.chatMessage.findUnique.mockResolvedValue({ ...pendingMessage, type: "TEXT", transactionId: null });
      await expect(service.acceptTransfer("u2", "m1")).rejects.toThrow(WsException);
      expect(transactionService.acceptTransfer).not.toHaveBeenCalled();
    });

    it("rejects a caller who isn't a member of the room", async () => {
      prisma.chatMessage.findUnique.mockResolvedValue(pendingMessage);
      prisma.chatMember.findUnique.mockResolvedValue(null);
      await expect(service.acceptTransfer("u2", "m1")).rejects.toThrow(WsException);
      expect(transactionService.acceptTransfer).not.toHaveBeenCalled();
    });

    it("propagates TransactionService's own rejection (e.g. not the recipient)", async () => {
      prisma.chatMessage.findUnique.mockResolvedValue(pendingMessage);
      prisma.chatMember.findUnique.mockResolvedValue({ roomId: "room-1", userId: "u2" });
      transactionService.acceptTransfer.mockRejectedValue(new Error("Only the recipient can accept this transfer"));

      await expect(service.acceptTransfer("u2", "m1")).rejects.toThrow("Only the recipient can accept this transfer");
    });

    it("accepts via TransactionService then reloads the settled message", async () => {
      prisma.chatMessage.findUnique.mockResolvedValue(pendingMessage);
      prisma.chatMember.findUnique.mockResolvedValue({ roomId: "room-1", userId: "u2" });
      transactionService.acceptTransfer.mockResolvedValue({ id: "txn-1", status: "COMPLETED" });
      prisma.chatMessage.findUniqueOrThrow.mockResolvedValue({
        ...pendingMessage,
        content: "5,000원을 보냈습니다",
        amount: 5000,
        createdAt: new Date(),
        sender: { username: "u1" },
        transaction: { status: "COMPLETED" },
      });

      const message = await service.acceptTransfer("u2", "m1");

      expect(transactionService.acceptTransfer).toHaveBeenCalledWith("txn-1", "u2");
      expect(message).toMatchObject({ id: "m1", transactionStatus: "COMPLETED" });
    });
  });

  describe("rejectTransfer", () => {
    const pendingMessage = {
      id: "m1",
      roomId: "room-1",
      senderId: "u1",
      type: "TRANSFER",
      transactionId: "txn-1",
    };

    beforeEach(() => {
      userService.findActiveById.mockResolvedValue(activeUser("u2"));
    });

    it("rejects a dormant/gone caller before ever loading the message", async () => {
      userService.findActiveById.mockResolvedValue(null);
      await expect(service.rejectTransfer("u2", "m1")).rejects.toThrow(WsException);
      expect(prisma.chatMessage.findUnique).not.toHaveBeenCalled();
      expect(transactionService.rejectTransfer).not.toHaveBeenCalled();
    });

    it("rejects a caller who isn't a member of the room", async () => {
      prisma.chatMessage.findUnique.mockResolvedValue(pendingMessage);
      prisma.chatMember.findUnique.mockResolvedValue(null);
      await expect(service.rejectTransfer("u2", "m1")).rejects.toThrow(WsException);
      expect(transactionService.rejectTransfer).not.toHaveBeenCalled();
    });

    it("rejects via TransactionService (auto-refunding the sender) then reloads the settled message", async () => {
      prisma.chatMessage.findUnique.mockResolvedValue(pendingMessage);
      prisma.chatMember.findUnique.mockResolvedValue({ roomId: "room-1", userId: "u2" });
      transactionService.rejectTransfer.mockResolvedValue({ id: "txn-1", status: "REJECTED" });
      prisma.chatMessage.findUniqueOrThrow.mockResolvedValue({
        ...pendingMessage,
        content: "5,000원을 보냈습니다",
        amount: 5000,
        createdAt: new Date(),
        sender: { username: "u1" },
        transaction: { status: "REJECTED" },
      });

      const message = await service.rejectTransfer("u2", "m1");

      expect(transactionService.rejectTransfer).toHaveBeenCalledWith("txn-1", "u2");
      expect(message).toMatchObject({ id: "m1", transactionStatus: "REJECTED" });
    });
  });

  describe("getHistory", () => {
    beforeEach(() => {
      userService.findActiveById.mockResolvedValue(activeUser("u1"));
      prisma.chatRoom.findUnique.mockResolvedValue({ id: "room-1", isGlobal: false });
      prisma.chatMember.findUnique.mockResolvedValue({ roomId: "room-1", userId: "u1" });
    });

    it("rejects when the room doesn't exist", async () => {
      prisma.chatRoom.findUnique.mockResolvedValue(null);
      await expect(service.getHistory("u1", { roomId: "missing-room" })).rejects.toThrow(WsException);
    });

    it("rejects a non-member from reading history", async () => {
      prisma.chatMember.findUnique.mockResolvedValue(null);
      await expect(service.getHistory("u1", { roomId: "room-1" })).rejects.toThrow(WsException);
    });

    it("skips the membership check for the global room", async () => {
      prisma.chatRoom.findUnique.mockResolvedValue({ id: "global-room", isGlobal: true });
      prisma.chatMember.findUnique.mockResolvedValue(null);
      prisma.chatMessage.findMany.mockResolvedValue([]);

      await expect(service.getHistory("u1", { roomId: "global-room" })).resolves.toBeDefined();
      expect(prisma.chatMember.findUnique).not.toHaveBeenCalled();
    });

    it("reports no next page when fewer rows than the limit come back", async () => {
      prisma.chatMessage.findMany.mockResolvedValue([
        { id: "m1", roomId: "room-1", senderId: "u1", content: "hi", createdAt: new Date(), sender: { username: "u1" } },
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
        sender: { username: "u1" },
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
          messages: [
            { id: "m1", roomId: "room-old", senderId: "u2", content: "hi", createdAt: older, sender: { username: "u2" } },
          ],
        },
        {
          id: "room-new",
          isGlobal: false,
          createdAt: newer,
          members: [{ roomId: "room-new", userId: "u1" }, { roomId: "room-new", userId: "u3" }],
          messages: [
            { id: "m2", roomId: "room-new", senderId: "u3", content: "hey", createdAt: newer, sender: { username: "u3" } },
          ],
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

  describe("getGlobalRoom", () => {
    it("rejects a dormant caller", async () => {
      userService.findActiveById.mockResolvedValue({ id: "u1", username: "u1", status: AccountStatus.DORMANT });
      await expect(service.getGlobalRoom("u1")).rejects.toThrow(WsException);
    });

    it("throws if no global room has been seeded", async () => {
      userService.findActiveById.mockResolvedValue(activeUser("u1"));
      prisma.chatRoom.findFirst.mockResolvedValue(null);
      await expect(service.getGlobalRoom("u1")).rejects.toThrow(WsException);
    });

    it("returns the seeded global room", async () => {
      userService.findActiveById.mockResolvedValue(activeUser("u1"));
      prisma.chatRoom.findFirst.mockResolvedValue({ id: "global-room", isGlobal: true });

      const room = await service.getGlobalRoom("u1");
      expect(room).toEqual({ id: "global-room", isGlobal: true });
    });
  });
});
