import { Test } from "@nestjs/testing";
import { ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccountStatus, ProductStatus, ReportStatus, ReportTargetType } from "@prisma/client";
import { AccountStatus as SharedAccountStatus } from "@secondhand/types";
import { AdminService } from "./admin.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TransactionService } from "../transaction/transaction.service";

describe("AdminService", () => {
  let service: AdminService;
  let prisma: {
    report: { findMany: jest.Mock; findUnique: jest.Mock };
    product: { findFirst: jest.Mock };
    user: { findFirst: jest.Mock; findMany: jest.Mock; update: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    report: { updateMany: jest.Mock };
    user: { update: jest.Mock };
    product: { update: jest.Mock };
  };
  let transactionService: { listAll: jest.Mock };

  const BLOCK_THRESHOLD = 5;

  beforeEach(async () => {
    tx = {
      report: { updateMany: jest.fn() },
      user: { update: jest.fn() },
      product: { update: jest.fn() },
    };
    prisma = {
      report: { findMany: jest.fn(), findUnique: jest.fn() },
      product: { findFirst: jest.fn() },
      user: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    };
    transactionService = { listAll: jest.fn() };

    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
        { provide: TransactionService, useValue: transactionService },
        { provide: ConfigService, useValue: { get: () => BLOCK_THRESHOLD } },
      ],
    }).compile();

    service = module.get(AdminService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("listReports", () => {
    it("maps a user-target report to its admin DTO shape", async () => {
      prisma.report.findMany.mockResolvedValue([
        {
          id: "r1",
          targetType: ReportTargetType.USER,
          reason: "spam",
          status: ReportStatus.PENDING,
          createdAt: new Date("2026-01-01T00:00:00Z"),
          reporter: { id: "reporter-1", username: "reporter" },
          targetUser: { id: "target-1", username: "baduser", status: AccountStatus.DORMANT },
          targetProduct: null,
        },
      ]);

      const [dto] = await service.listReports();

      expect(dto.reporter).toEqual({ id: "reporter-1", username: "reporter" });
      expect(dto.target).toEqual({ type: "USER", id: "target-1", label: "baduser", status: "DORMANT" });
    });
  });

  describe("reviewReport", () => {
    it("rejects reviewing a report that no longer exists", async () => {
      prisma.report.findUnique.mockResolvedValue(null);
      await expect(service.reviewReport("missing", "RESOLVED", "admin-1")).rejects.toThrow(NotFoundException);
    });

    it("rejects reviewing an already-decided report", async () => {
      prisma.report.findUnique.mockResolvedValue({ id: "r1", status: ReportStatus.RESOLVED });
      await expect(service.reviewReport("r1", "REJECTED", "admin-1")).rejects.toThrow(ConflictException);
    });

    it("on RESOLVED, flips the report status and records who reviewed it, leaving the target alone", async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: "r1",
        status: ReportStatus.PENDING,
        targetType: ReportTargetType.USER,
        targetUserId: "target-1",
      });
      tx.report.updateMany.mockResolvedValue({ count: 1 });

      await service.reviewReport("r1", "RESOLVED", "admin-1");

      expect(tx.report.updateMany).toHaveBeenCalledWith({
        where: { id: "r1", status: ReportStatus.PENDING },
        data: { status: ReportStatus.RESOLVED, reviewedById: "admin-1", reviewedAt: expect.any(Date) },
      });
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it("rejects a concurrent double-review (updateMany count guard) without double-applying the decrement", async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: "r1",
        status: ReportStatus.PENDING,
        targetType: ReportTargetType.USER,
        targetUserId: "target-1",
      });
      tx.report.updateMany.mockResolvedValue({ count: 0 });

      await expect(service.reviewReport("r1", "REJECTED", "admin-1")).rejects.toThrow(ConflictException);
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it("on REJECTED, decrements the target user's reportCount and restores ACTIVE once under threshold", async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: "r1",
        status: ReportStatus.PENDING,
        targetType: ReportTargetType.USER,
        targetUserId: "target-1",
      });
      tx.report.updateMany.mockResolvedValue({ count: 1 });
      tx.user.update.mockResolvedValueOnce({
        id: "target-1",
        reportCount: BLOCK_THRESHOLD - 1,
        status: AccountStatus.DORMANT,
      });

      await service.reviewReport("r1", "REJECTED", "admin-1");

      expect(tx.user.update).toHaveBeenNthCalledWith(1, {
        where: { id: "target-1" },
        data: { reportCount: { decrement: 1 } },
      });
      expect(tx.user.update).toHaveBeenNthCalledWith(2, {
        where: { id: "target-1" },
        data: { status: AccountStatus.ACTIVE },
      });
    });

    it("on REJECTED, leaves the target blocked if reportCount is still at/above threshold", async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: "r1",
        status: ReportStatus.PENDING,
        targetType: ReportTargetType.PRODUCT,
        targetProductId: "product-1",
      });
      tx.report.updateMany.mockResolvedValue({ count: 1 });
      tx.product.update.mockResolvedValueOnce({
        id: "product-1",
        reportCount: BLOCK_THRESHOLD,
        status: ProductStatus.BLOCKED,
      });

      await service.reviewReport("r1", "REJECTED", "admin-1");

      expect(tx.product.update).toHaveBeenCalledTimes(1);
    });
  });

  describe("deleteProduct", () => {
    it("rejects deleting a product that doesn't exist (or is already deleted)", async () => {
      prisma.product.findFirst.mockResolvedValue(null);
      await expect(service.deleteProduct("missing", "admin-1")).rejects.toThrow(NotFoundException);
    });

    it("soft-deletes the product and auto-resolves its still-pending reports", async () => {
      prisma.product.findFirst.mockResolvedValue({ id: "product-1", deletedAt: null });

      await service.deleteProduct("product-1", "admin-1");

      expect(tx.product.update).toHaveBeenCalledWith({
        where: { id: "product-1" },
        data: { deletedAt: expect.any(Date) },
      });
      expect(tx.report.updateMany).toHaveBeenCalledWith({
        where: { targetProductId: "product-1", status: ReportStatus.PENDING },
        data: { status: ReportStatus.RESOLVED, reviewedById: "admin-1", reviewedAt: expect.any(Date) },
      });
    });
  });

  describe("listUsers", () => {
    it("maps users to the admin DTO shape, excluding soft-deleted rows via the query", async () => {
      prisma.user.findMany.mockResolvedValue([
        {
          id: "u1",
          username: "alice",
          status: AccountStatus.ACTIVE,
          role: "USER",
          balance: 50_000,
          reportCount: 2,
          createdAt: new Date("2026-01-01T00:00:00Z"),
        },
      ]);

      const [dto] = await service.listUsers();

      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null },
        orderBy: { createdAt: "desc" },
      });
      expect(dto).toEqual({
        id: "u1",
        username: "alice",
        status: "ACTIVE",
        role: "USER",
        balance: 50_000,
        reportCount: 2,
        createdAt: "2026-01-01T00:00:00.000Z",
      });
    });

    it("filters by status when provided", async () => {
      prisma.user.findMany.mockResolvedValue([]);
      await service.listUsers(SharedAccountStatus.DORMANT);
      expect(prisma.user.findMany).toHaveBeenCalledWith({
        where: { deletedAt: null, status: AccountStatus.DORMANT },
        orderBy: { createdAt: "desc" },
      });
    });
  });

  describe("setUserStatus", () => {
    it("rejects an admin trying to change their own status, before ever touching the db", async () => {
      await expect(service.setUserStatus("admin-1", SharedAccountStatus.DORMANT, "admin-1")).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.user.findFirst).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("rejects when the user doesn't exist", async () => {
      prisma.user.findFirst.mockResolvedValue(null);
      await expect(service.setUserStatus("missing", SharedAccountStatus.DORMANT, "admin-1")).rejects.toThrow(
        NotFoundException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it("sets the status without touching reportCount", async () => {
      prisma.user.findFirst.mockResolvedValue({ id: "u1", deletedAt: null });
      await service.setUserStatus("u1", SharedAccountStatus.ACTIVE, "admin-1");
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: "u1" },
        data: { status: AccountStatus.ACTIVE },
      });
    });
  });

  describe("listTransactions", () => {
    it("delegates to TransactionService.listAll", async () => {
      transactionService.listAll.mockResolvedValue({ items: [], nextCursor: null });
      const result = await service.listTransactions("cursor-1", 10);
      expect(transactionService.listAll).toHaveBeenCalledWith("cursor-1", 10);
      expect(result).toEqual({ items: [], nextCursor: null });
    });
  });
});
