import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AccountStatus,
  ProductStatus,
  Report as PrismaReport,
  ReportTargetType as PrismaReportTargetType,
} from "@prisma/client";
import { ReportTargetType } from "@secondhand/types";
import type { CreateReportRequest, ReportDto, ReportStatus as SharedReportStatus } from "@secondhand/types";
import { isUniqueConstraintError } from "../../common/utils/prisma-errors";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { UserService } from "../user/user.service";
import { MIN_REPORTER_ACCOUNT_AGE_MS } from "./report.constants";

@Injectable()
export class ReportService {
  private readonly blockThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
    configService: ConfigService,
  ) {
    this.blockThreshold = configService.get<number>("REPORT_BLOCK_THRESHOLD")!;
  }

  async create(reporterId: string, dto: CreateReportRequest): Promise<ReportDto> {
    await this.assertReporterEligible(reporterId);

    if (dto.targetType === ReportTargetType.USER) {
      return this.reportUser(reporterId, dto);
    }
    return this.reportProduct(reporterId, dto);
  }

  private async assertReporterEligible(reporterId: string): Promise<void> {
    const reporter = await this.userService.findActiveById(reporterId);
    if (!reporter) throw new NotFoundException("Reporter not found");

    // Minimal collusion/abuse friction: this schema has no IP/device
    // fingerprint to detect coordinated sockpuppet accounts, so the
    // cheapest real signal available is account age. This does not stop an
    // attacker who ages throwaway accounts in advance — real defense would
    // need device/IP tracking, out of scope for this MVP schema. Combined
    // with REPORT_THROTTLE and the one-report-per-target unique
    // constraint, this raises the cost of brigading without a schema
    // change.
    const ageMs = Date.now() - reporter.createdAt.getTime();
    if (ageMs < MIN_REPORTER_ACCOUNT_AGE_MS) {
      throw new ForbiddenException("Account is too new to file reports");
    }
  }

  private async reportUser(reporterId: string, dto: CreateReportRequest): Promise<ReportDto> {
    if (dto.targetId === reporterId) {
      throw new BadRequestException("Cannot report yourself");
    }

    const targetUser = await this.prisma.user.findFirst({
      where: { id: dto.targetId, deletedAt: null },
    });
    if (!targetUser) throw new NotFoundException("Target user not found");

    try {
      return await this.prisma.$transaction(async (tx) => {
        const report = await tx.report.create({
          data: {
            reporterId,
            targetType: PrismaReportTargetType.USER,
            targetUserId: dto.targetId,
            reason: dto.reason,
          },
        });

        // The increment's return value IS the post-increment count, which
        // is what makes this race-free. A SELECT-then-UPDATE pair would
        // let two concurrent reports both read count=4, both decide "not
        // yet at threshold", and both write 5 — permanently losing the
        // fact that the 5th report should have crossed it.
        const updatedUser = await tx.user.update({
          where: { id: dto.targetId },
          data: { reportCount: { increment: 1 } },
        });

        if (updatedUser.reportCount >= this.blockThreshold) {
          // Stage 1 (automatic, reversible): flip to DORMANT, which this
          // codebase already treats as "restricted" (blocks login, product
          // registration, and — once built — chat). This is not a
          // permanent ban: the schema has no separate "flagged/under
          // review" state, so DORMANT is reused as that state. Stage 2
          // (human review of the PENDING report row this created) decides
          // whether to keep it restricted or reactivate the account.
          await tx.user.update({
            where: { id: dto.targetId },
            data: { status: AccountStatus.DORMANT },
          });
        }

        return this.toReportDto(report);
      });
    } catch (error) {
      throw this.translateError(error);
    }
  }

  private async reportProduct(reporterId: string, dto: CreateReportRequest): Promise<ReportDto> {
    const targetProduct = await this.prisma.product.findFirst({
      where: { id: dto.targetId, deletedAt: null },
    });
    if (!targetProduct) throw new NotFoundException("Target product not found");
    if (targetProduct.sellerId === reporterId) {
      throw new BadRequestException("Cannot report your own product");
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const report = await tx.report.create({
          data: {
            reporterId,
            targetType: PrismaReportTargetType.PRODUCT,
            targetProductId: dto.targetId,
            reason: dto.reason,
          },
        });

        const updatedProduct = await tx.product.update({
          where: { id: dto.targetId },
          data: { reportCount: { increment: 1 } },
        });

        if (updatedProduct.reportCount >= this.blockThreshold) {
          // Stage 1 (automatic, reversible): temporary listing
          // restriction. ProductService.list/findDetail already exclude
          // BLOCKED items, so this immediately hides the listing without
          // deleting it. Stage 2 (human review) can revert to ACTIVE if
          // the reports turn out unwarranted.
          await tx.product.update({
            where: { id: dto.targetId },
            data: { status: ProductStatus.BLOCKED },
          });
        }

        return this.toReportDto(report);
      });
    } catch (error) {
      throw this.translateError(error);
    }
  }

  private translateError(error: unknown): Error {
    if (isUniqueConstraintError(error)) {
      return new ConflictException("You have already reported this target");
    }
    return error as Error;
  }

  private toReportDto(report: PrismaReport): ReportDto {
    return {
      id: report.id,
      targetType: report.targetType as unknown as ReportTargetType,
      reason: report.reason,
      status: report.status as unknown as SharedReportStatus,
      createdAt: report.createdAt.toISOString(),
    };
  }
}
