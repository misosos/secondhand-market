import { Test } from "@nestjs/testing";
import { ConflictException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccountStatus, ProductStatus, ReportStatus, ReportTargetType } from "@prisma/client";
import { AdminService } from "./admin.service";
import { PrismaService } from "../../infra/prisma/prisma.service";

describe("AdminService", () => {
  let service: AdminService;
  let prisma: {
    report: { findMany: jest.Mock; findUnique: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    report: { update: jest.Mock };
    user: { update: jest.Mock };
    product: { update: jest.Mock };
  };

  const BLOCK_THRESHOLD = 5;

  beforeEach(async () => {
    tx = {
      report: { update: jest.fn() },
      user: { update: jest.fn() },
      product: { update: jest.fn() },
    };
    prisma = {
      report: { findMany: jest.fn(), findUnique: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    };

    const module = await Test.createTestingModule({
      providers: [
        AdminService,
        { provide: PrismaService, useValue: prisma },
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
      await expect(service.reviewReport("missing", "RESOLVED")).rejects.toThrow(NotFoundException);
    });

    it("rejects reviewing an already-decided report", async () => {
      prisma.report.findUnique.mockResolvedValue({ id: "r1", status: ReportStatus.RESOLVED });
      await expect(service.reviewReport("r1", "REJECTED")).rejects.toThrow(ConflictException);
    });

    it("on RESOLVED, only flips the report status and leaves the target alone", async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: "r1",
        status: ReportStatus.PENDING,
        targetType: ReportTargetType.USER,
        targetUserId: "target-1",
      });

      await service.reviewReport("r1", "RESOLVED");

      expect(tx.report.update).toHaveBeenCalledWith({ where: { id: "r1" }, data: { status: ReportStatus.RESOLVED } });
      expect(tx.user.update).not.toHaveBeenCalled();
    });

    it("on REJECTED, decrements the target user's reportCount and restores ACTIVE once under threshold", async () => {
      prisma.report.findUnique.mockResolvedValue({
        id: "r1",
        status: ReportStatus.PENDING,
        targetType: ReportTargetType.USER,
        targetUserId: "target-1",
      });
      tx.user.update.mockResolvedValueOnce({
        id: "target-1",
        reportCount: BLOCK_THRESHOLD - 1,
        status: AccountStatus.DORMANT,
      });

      await service.reviewReport("r1", "REJECTED");

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
      tx.product.update.mockResolvedValueOnce({
        id: "product-1",
        reportCount: BLOCK_THRESHOLD,
        status: ProductStatus.BLOCKED,
      });

      await service.reviewReport("r1", "REJECTED");

      expect(tx.product.update).toHaveBeenCalledTimes(1);
    });
  });
});
