import { Test } from "@nestjs/testing";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { AccountStatus, ProductStatus } from "@prisma/client";
import { ProductService } from "./product.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { UserService } from "../user/user.service";

describe("ProductService", () => {
  let service: ProductService;
  let prisma: {
    product: { findMany: jest.Mock; findFirst: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: { productImage: { deleteMany: jest.Mock }; product: { update: jest.Mock } };
  let userService: { findActiveById: jest.Mock };

  const activeSeller = { id: "seller-1", status: AccountStatus.ACTIVE };

  beforeEach(async () => {
    tx = {
      productImage: { deleteMany: jest.fn() },
      product: { update: jest.fn() },
    };
    prisma = {
      product: { findMany: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    };
    userService = { findActiveById: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: userService },
      ],
    }).compile();

    service = module.get(ProductService);
  });

  describe("listMine", () => {
    it("includes non-ACTIVE (blocked/sold) listings, unlike the public list", async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          id: "p1",
          name: "blocked item",
          price: 1000,
          status: ProductStatus.BLOCKED,
          createdAt: new Date(),
          images: [],
        },
      ]);

      const result = await service.listMine("seller-1");

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sellerId: "seller-1", deletedAt: null } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "p1", status: ProductStatus.BLOCKED });
    });
  });

  describe("update", () => {
    it("rejects a dormant seller before ever looking up the product", async () => {
      userService.findActiveById.mockResolvedValue({ ...activeSeller, status: AccountStatus.DORMANT });
      await expect(service.update("seller-1", "p1", { name: "new name" })).rejects.toThrow(ForbiddenException);
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
    });

    it("rejects editing a product you don't own", async () => {
      userService.findActiveById.mockResolvedValue(activeSeller);
      prisma.product.findFirst.mockResolvedValue({ id: "p1", sellerId: "someone-else", deletedAt: null });
      await expect(service.update("seller-1", "p1", { name: "new name" })).rejects.toThrow(ForbiddenException);
    });

    it("updates an owned product for an active seller", async () => {
      userService.findActiveById.mockResolvedValue(activeSeller);
      prisma.product.findFirst.mockResolvedValue({ id: "p1", sellerId: "seller-1", deletedAt: null });
      tx.product.update.mockResolvedValue({
        id: "p1",
        name: "new name",
        price: 1000,
        status: ProductStatus.ACTIVE,
        createdAt: new Date(),
        images: [],
      });

      const result = await service.update("seller-1", "p1", { name: "new name" });
      expect(result.name).toBe("new name");
    });
  });

  describe("assertUploadEligible", () => {
    it("rejects a dormant seller from minting a presigned upload URL", async () => {
      userService.findActiveById.mockResolvedValue({ ...activeSeller, status: AccountStatus.DORMANT });
      await expect(service.assertUploadEligible("seller-1")).rejects.toThrow(ForbiddenException);
    });

    it("rejects an unknown seller", async () => {
      userService.findActiveById.mockResolvedValue(null);
      await expect(service.assertUploadEligible("ghost")).rejects.toThrow(NotFoundException);
    });

    it("allows an active seller", async () => {
      userService.findActiveById.mockResolvedValue(activeSeller);
      await expect(service.assertUploadEligible("seller-1")).resolves.toBeUndefined();
    });
  });

  describe("remove", () => {
    it("rejects a dormant seller before ever looking up the product", async () => {
      userService.findActiveById.mockResolvedValue({ ...activeSeller, status: AccountStatus.DORMANT });
      await expect(service.remove("seller-1", "p1")).rejects.toThrow(ForbiddenException);
      expect(prisma.product.findFirst).not.toHaveBeenCalled();
    });

    it("rejects when the product doesn't exist (or is already deleted)", async () => {
      userService.findActiveById.mockResolvedValue(activeSeller);
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.remove("seller-1", "p1")).rejects.toThrow(NotFoundException);
    });

    it("soft-deletes an owned product for an active seller", async () => {
      userService.findActiveById.mockResolvedValue(activeSeller);
      prisma.product.findFirst.mockResolvedValue({ id: "p1", sellerId: "seller-1", deletedAt: null });

      await service.remove("seller-1", "p1");

      expect(prisma.product.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});
