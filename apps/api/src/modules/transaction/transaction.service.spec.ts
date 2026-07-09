import { Test } from "@nestjs/testing";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { AccountStatus, ProductStatus } from "@prisma/client";
import { TransactionService } from "./transaction.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { UserService } from "../user/user.service";

describe("TransactionService", () => {
  let service: TransactionService;
  let prisma: {
    product: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    product: { updateMany: jest.Mock };
    user: { updateMany: jest.Mock; update: jest.Mock };
    transaction: { create: jest.Mock };
  };
  let userService: { findActiveById: jest.Mock };

  const activeBuyer = { id: "buyer-1", status: AccountStatus.ACTIVE, balance: 10_000 };
  const product = {
    id: "product-1",
    price: 5_000,
    status: ProductStatus.ACTIVE,
    sellerId: "seller-1",
    seller: { id: "seller-1", username: "seller" },
  };

  beforeEach(async () => {
    tx = {
      product: { updateMany: jest.fn() },
      user: { updateMany: jest.fn(), update: jest.fn() },
      transaction: { create: jest.fn() },
    };
    prisma = {
      product: { findFirst: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    };
    userService = { findActiveById: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get(TransactionService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("purchase", () => {
    it("rejects when the buyer account doesn't exist", async () => {
      userService.findActiveById.mockResolvedValue(null);
      await expect(service.purchase("buyer-1", "product-1")).rejects.toThrow(NotFoundException);
    });

    it("rejects a dormant buyer", async () => {
      userService.findActiveById.mockResolvedValue({ ...activeBuyer, status: AccountStatus.DORMANT });
      await expect(service.purchase("buyer-1", "product-1")).rejects.toThrow(ForbiddenException);
    });

    it("rejects when the product doesn't exist", async () => {
      userService.findActiveById.mockResolvedValue(activeBuyer);
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.purchase("buyer-1", "product-1")).rejects.toThrow(NotFoundException);
    });

    it("rejects buying your own product", async () => {
      userService.findActiveById.mockResolvedValue(activeBuyer);
      prisma.product.findFirst.mockResolvedValue({ ...product, sellerId: "buyer-1" });
      await expect(service.purchase("buyer-1", "product-1")).rejects.toThrow(BadRequestException);
    });

    it("rejects when the product is not ACTIVE (already sold/blocked)", async () => {
      userService.findActiveById.mockResolvedValue(activeBuyer);
      prisma.product.findFirst.mockResolvedValue({ ...product, status: ProductStatus.SOLD });
      await expect(service.purchase("buyer-1", "product-1")).rejects.toThrow(ConflictException);
    });

    it("rejects when the buyer's balance is below the price (checked before the transaction)", async () => {
      userService.findActiveById.mockResolvedValue({ ...activeBuyer, balance: 1_000 });
      prisma.product.findFirst.mockResolvedValue(product);
      await expect(service.purchase("buyer-1", "product-1")).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects if a concurrent purchase already sold the product (updateMany count guard)", async () => {
      userService.findActiveById.mockResolvedValue(activeBuyer);
      prisma.product.findFirst.mockResolvedValue(product);
      tx.product.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.purchase("buyer-1", "product-1")).rejects.toThrow(ConflictException);
      expect(tx.user.updateMany).not.toHaveBeenCalled();
    });

    it("rejects if the buyer's balance dropped below price by the time of the write (updateMany count guard)", async () => {
      userService.findActiveById.mockResolvedValue(activeBuyer);
      prisma.product.findFirst.mockResolvedValue(product);
      tx.product.updateMany.mockResolvedValue({ count: 1 });
      tx.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.purchase("buyer-1", "product-1")).rejects.toThrow(BadRequestException);
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it("moves balance from buyer to seller, flips the product to SOLD, and records the transaction", async () => {
      userService.findActiveById.mockResolvedValue(activeBuyer);
      prisma.product.findFirst.mockResolvedValue(product);
      tx.product.updateMany.mockResolvedValue({ count: 1 });
      tx.user.updateMany.mockResolvedValue({ count: 1 });
      tx.transaction.create.mockResolvedValue({
        id: "txn-1",
        productId: "product-1",
        amount: 5_000,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        buyer: { id: "buyer-1", username: "buyer" },
        seller: { id: "seller-1", username: "seller" },
        product: { name: "위젯" },
      });

      const dto = await service.purchase("buyer-1", "product-1");

      expect(tx.product.updateMany).toHaveBeenCalledWith({
        where: { id: "product-1", status: ProductStatus.ACTIVE },
        data: { status: ProductStatus.SOLD },
      });
      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: "buyer-1", balance: { gte: 5_000 } },
        data: { balance: { decrement: 5_000 } },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: "seller-1" },
        data: { balance: { increment: 5_000 } },
      });
      expect(dto).toEqual({
        id: "txn-1",
        productId: "product-1",
        productName: "위젯",
        buyer: { id: "buyer-1", username: "buyer" },
        seller: { id: "seller-1", username: "seller" },
        amount: 5_000,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    });
  });

  describe("transferBalance", () => {
    const activeRecipient = { id: "recipient-1", status: AccountStatus.ACTIVE, balance: 0 };

    it("rejects sending money to yourself, before ever touching the db", async () => {
      await expect(service.transferBalance("u1", "u1", 1000)).rejects.toThrow(BadRequestException);
      expect(userService.findActiveById).not.toHaveBeenCalled();
    });

    it("rejects a non-positive or non-integer amount", async () => {
      await expect(service.transferBalance("sender-1", "recipient-1", 0)).rejects.toThrow(BadRequestException);
      await expect(service.transferBalance("sender-1", "recipient-1", 1.5)).rejects.toThrow(BadRequestException);
    });

    it("rejects when the sender doesn't exist", async () => {
      userService.findActiveById.mockResolvedValueOnce(null);
      await expect(service.transferBalance("sender-1", "recipient-1", 1000)).rejects.toThrow(NotFoundException);
    });

    it("rejects a dormant sender", async () => {
      userService.findActiveById.mockResolvedValueOnce({ ...activeBuyer, status: AccountStatus.DORMANT });
      await expect(service.transferBalance("sender-1", "recipient-1", 1000)).rejects.toThrow(ForbiddenException);
    });

    it("rejects when the recipient doesn't exist", async () => {
      userService.findActiveById.mockResolvedValueOnce(activeBuyer).mockResolvedValueOnce(null);
      await expect(service.transferBalance("sender-1", "recipient-1", 1000)).rejects.toThrow(NotFoundException);
    });

    it("rejects sending to a dormant recipient", async () => {
      userService.findActiveById
        .mockResolvedValueOnce(activeBuyer)
        .mockResolvedValueOnce({ ...activeRecipient, status: AccountStatus.DORMANT });
      await expect(service.transferBalance("sender-1", "recipient-1", 1000)).rejects.toThrow(ForbiddenException);
    });

    it("rejects when the sender's balance is below the amount", async () => {
      userService.findActiveById
        .mockResolvedValueOnce({ ...activeBuyer, balance: 500 })
        .mockResolvedValueOnce(activeRecipient);
      await expect(service.transferBalance("sender-1", "recipient-1", 1000)).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects if the sender's balance dropped by write time (updateMany count guard)", async () => {
      userService.findActiveById.mockResolvedValueOnce(activeBuyer).mockResolvedValueOnce(activeRecipient);
      tx.user.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.transferBalance("sender-1", "recipient-1", 1000)).rejects.toThrow(BadRequestException);
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it("moves balance with no product involved, and records a productId:null transaction", async () => {
      userService.findActiveById.mockResolvedValueOnce(activeBuyer).mockResolvedValueOnce(activeRecipient);
      tx.user.updateMany.mockResolvedValue({ count: 1 });
      tx.transaction.create.mockResolvedValue({
        id: "txn-2",
        productId: null,
        amount: 3_000,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        buyer: { id: "sender-1", username: "sender" },
        seller: { id: "recipient-1", username: "recipient" },
        product: null,
      });

      const dto = await service.transferBalance("sender-1", "recipient-1", 3_000);

      expect(tx.user.updateMany).toHaveBeenCalledWith({
        where: { id: "sender-1", balance: { gte: 3_000 } },
        data: { balance: { decrement: 3_000 } },
      });
      expect(tx.user.update).toHaveBeenCalledWith({
        where: { id: "recipient-1" },
        data: { balance: { increment: 3_000 } },
      });
      expect(tx.transaction.create).toHaveBeenCalledWith({
        data: { buyerId: "sender-1", sellerId: "recipient-1", productId: null, amount: 3_000 },
        include: { buyer: true, seller: true, product: true },
      });
      expect(dto).toEqual({
        id: "txn-2",
        productId: null,
        productName: null,
        buyer: { id: "sender-1", username: "sender" },
        seller: { id: "recipient-1", username: "recipient" },
        amount: 3_000,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    });
  });
});
