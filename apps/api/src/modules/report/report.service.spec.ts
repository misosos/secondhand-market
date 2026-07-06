import { Test } from "@nestjs/testing";
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccountStatus, ProductStatus } from "@prisma/client";
import { ReportTargetType } from "@secondhand/types";
import { ReportService } from "./report.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { UserService } from "../user/user.service";
import { MIN_REPORTER_ACCOUNT_AGE_MS } from "./report.constants";

describe("ReportService (core auto-moderation logic)", () => {
  let service: ReportService;
  let prisma: {
    user: { findFirst: jest.Mock };
    product: { findFirst: jest.Mock };
    $transaction: jest.Mock;
  };
  let tx: {
    report: { create: jest.Mock };
    user: { update: jest.Mock };
    product: { update: jest.Mock };
  };
  let userService: { findActiveById: jest.Mock };

  const activeReporter = {
    id: "reporter-1",
    // Well past MIN_REPORTER_ACCOUNT_AGE_MS so eligibility checks pass by default.
    createdAt: new Date(Date.now() - MIN_REPORTER_ACCOUNT_AGE_MS * 10),
  };

  beforeEach(async () => {
    tx = {
      report: { create: jest.fn() },
      user: { update: jest.fn() },
      product: { update: jest.fn() },
    };
    prisma = {
      user: { findFirst: jest.fn() },
      product: { findFirst: jest.fn() },
      $transaction: jest.fn((callback: (tx: unknown) => unknown) => callback(tx)),
    };
    userService = { findActiveById: jest.fn() };

    const configService = { get: jest.fn().mockReturnValue(5) };

    const module = await Test.createTestingModule({
      providers: [
        ReportService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: userService },
        { provide: ConfigService, useValue: configService },
      ],
    }).compile();

    service = module.get(ReportService);
  });

  afterEach(() => jest.clearAllMocks());

  describe("reporter eligibility", () => {
    it("rejects when the reporter account no longer exists", async () => {
      userService.findActiveById.mockResolvedValue(null);

      await expect(
        service.create("reporter-1", { targetType: ReportTargetType.USER, targetId: "u2", reason: "spam" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("rejects a freshly created account (anti sockpuppet-brigading friction)", async () => {
      userService.findActiveById.mockResolvedValue({ id: "reporter-1", createdAt: new Date() });

      await expect(
        service.create("reporter-1", { targetType: ReportTargetType.USER, targetId: "u2", reason: "spam" }),
      ).rejects.toThrow(ForbiddenException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("reporting a user", () => {
    beforeEach(() => {
      userService.findActiveById.mockResolvedValue(activeReporter);
    });

    it("rejects self-reports", async () => {
      await expect(
        service.create("reporter-1", { targetType: ReportTargetType.USER, targetId: "reporter-1", reason: "x" }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects when the target user does not exist", async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      await expect(
        service.create("reporter-1", { targetType: ReportTargetType.USER, targetId: "ghost", reason: "x" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("translates a duplicate report (unique constraint) into 409, not 500", async () => {
      prisma.user.findFirst.mockResolvedValue({ id: "u2" });
      tx.report.create.mockRejectedValue({ code: "P2002" });

      await expect(
        service.create("reporter-1", { targetType: ReportTargetType.USER, targetId: "u2", reason: "x" }),
      ).rejects.toThrow(ConflictException);
    });

    it("does NOT flip the account below threshold", async () => {
      prisma.user.findFirst.mockResolvedValue({ id: "u2" });
      tx.report.create.mockResolvedValue({
        id: "r1",
        targetType: "USER",
        reason: "x",
        status: "PENDING",
        createdAt: new Date(),
      });
      tx.user.update.mockResolvedValue({ reportCount: 3 });

      await service.create("reporter-1", { targetType: ReportTargetType.USER, targetId: "u2", reason: "x" });

      // Only the increment call — no second call flipping status.
      expect(tx.user.update).toHaveBeenCalledTimes(1);
    });

    it("flips the account to DORMANT the moment the increment crosses the threshold", async () => {
      // This is the race-condition-sensitive part: the decision is made
      // from the `update`'s own return value (the post-increment count),
      // never from a separate read.
      prisma.user.findFirst.mockResolvedValue({ id: "u2" });
      tx.report.create.mockResolvedValue({
        id: "r1",
        targetType: "USER",
        reason: "x",
        status: "PENDING",
        createdAt: new Date(),
      });
      tx.user.update.mockResolvedValueOnce({ reportCount: 5 });

      await service.create("reporter-1", { targetType: ReportTargetType.USER, targetId: "u2", reason: "x" });

      expect(tx.user.update).toHaveBeenCalledTimes(2);
      expect(tx.user.update).toHaveBeenNthCalledWith(2, {
        where: { id: "u2" },
        data: { status: AccountStatus.DORMANT },
      });
    });
  });

  describe("reporting a product", () => {
    beforeEach(() => {
      userService.findActiveById.mockResolvedValue(activeReporter);
    });

    it("rejects reporting your own product", async () => {
      prisma.product.findFirst.mockResolvedValue({ id: "p1", sellerId: "reporter-1" });

      await expect(
        service.create("reporter-1", { targetType: ReportTargetType.PRODUCT, targetId: "p1", reason: "x" }),
      ).rejects.toThrow(BadRequestException);
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it("rejects when the target product does not exist", async () => {
      prisma.product.findFirst.mockResolvedValue(null);

      await expect(
        service.create("reporter-1", { targetType: ReportTargetType.PRODUCT, targetId: "ghost", reason: "x" }),
      ).rejects.toThrow(NotFoundException);
    });

    it("blocks the listing the moment the increment crosses the threshold", async () => {
      prisma.product.findFirst.mockResolvedValue({ id: "p1", sellerId: "other-seller" });
      tx.report.create.mockResolvedValue({
        id: "r2",
        targetType: "PRODUCT",
        reason: "x",
        status: "PENDING",
        createdAt: new Date(),
      });
      tx.product.update.mockResolvedValueOnce({ reportCount: 5 });

      await service.create("reporter-1", { targetType: ReportTargetType.PRODUCT, targetId: "p1", reason: "x" });

      expect(tx.product.update).toHaveBeenCalledTimes(2);
      expect(tx.product.update).toHaveBeenNthCalledWith(2, {
        where: { id: "p1" },
        data: { status: ProductStatus.BLOCKED },
      });
    });

    it("does NOT block the listing below threshold", async () => {
      prisma.product.findFirst.mockResolvedValue({ id: "p1", sellerId: "other-seller" });
      tx.report.create.mockResolvedValue({
        id: "r2",
        targetType: "PRODUCT",
        reason: "x",
        status: "PENDING",
        createdAt: new Date(),
      });
      tx.product.update.mockResolvedValue({ reportCount: 1 });

      await service.create("reporter-1", { targetType: ReportTargetType.PRODUCT, targetId: "p1", reason: "x" });

      expect(tx.product.update).toHaveBeenCalledTimes(1);
    });
  });
});
