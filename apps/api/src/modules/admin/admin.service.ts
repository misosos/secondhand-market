import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccountStatus, ProductStatus, ReportStatus as PrismaReportStatus, ReportTargetType as PrismaReportTargetType } from "@prisma/client";
import { ReportTargetType as SharedReportTargetType } from "@secondhand/types";
import type {
  AdminReportDto,
  AdminUserDto,
  AccountStatus as SharedAccountStatus,
  CursorPaginationResult,
  ReportDecision,
  ReportStatus as SharedReportStatus,
  Role as SharedRole,
  TransactionDto,
} from "@secondhand/types";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { TransactionService } from "../transaction/transaction.service";

@Injectable()
export class AdminService {
  private readonly blockThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly transactionService: TransactionService,
    configService: ConfigService,
  ) {
    this.blockThreshold = configService.get<number>("REPORT_BLOCK_THRESHOLD")!;
  }

  async listUsers(status?: SharedAccountStatus): Promise<AdminUserDto[]> {
    const users = await this.prisma.user.findMany({
      where: { deletedAt: null, ...(status ? { status: status as unknown as AccountStatus } : {}) },
      orderBy: { createdAt: "desc" },
    });

    return users.map((user) => ({
      id: user.id,
      username: user.username,
      status: user.status as unknown as SharedAccountStatus,
      role: user.role as unknown as SharedRole,
      balance: user.balance,
      reportCount: user.reportCount,
      createdAt: user.createdAt.toISOString(),
    }));
  }

  // Direct moderation override — distinct from the automatic threshold
  // flip in ReportService and the reversal in reviewReport() below, both of
  // which move reportCount in lockstep with status. This just sets status;
  // reportCount is left alone deliberately, so a later report-review action
  // still has an accurate count to reason about.
  async setUserStatus(userId: string, status: SharedAccountStatus): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId, deletedAt: null } });
    if (!user) throw new NotFoundException("User not found");
    await this.prisma.user.update({ where: { id: userId }, data: { status: status as unknown as AccountStatus } });
  }

  listTransactions(cursor?: string, limit?: number): Promise<CursorPaginationResult<TransactionDto>> {
    return this.transactionService.listAll(cursor, limit);
  }

  async listReports(status?: SharedReportStatus): Promise<AdminReportDto[]> {
    const reports = await this.prisma.report.findMany({
      where: status ? { status: status as unknown as PrismaReportStatus } : {},
      orderBy: { createdAt: "desc" },
      include: { reporter: true, targetUser: true, targetProduct: true, reviewedBy: true },
    });

    return reports.map((report) => ({
      id: report.id,
      targetType: report.targetType as unknown as SharedReportTargetType,
      reason: report.reason,
      status: report.status as unknown as SharedReportStatus,
      createdAt: report.createdAt.toISOString(),
      reporter: { id: report.reporter.id, username: report.reporter.username },
      reviewedBy: report.reviewedBy ? { id: report.reviewedBy.id, username: report.reviewedBy.username } : null,
      reviewedAt: report.reviewedAt ? report.reviewedAt.toISOString() : null,
      target:
        report.targetType === PrismaReportTargetType.USER
          ? {
              type: SharedReportTargetType.USER,
              id: report.targetUser!.id,
              label: report.targetUser!.username,
              status: report.targetUser!.status,
            }
          : {
              type: SharedReportTargetType.PRODUCT,
              id: report.targetProduct!.id,
              label: report.targetProduct!.name,
              status: report.targetProduct!.status,
            },
    }));
  }

  // REJECTED undoes this report's contribution to the target's reportCount
  // and lifts the auto-block if that brings it back under threshold — the
  // reversal path the auto-threshold block in ReportService never had.
  // RESOLVED just records the outcome: the auto-block (if any) already
  // enforced the consequence at report-creation time.
  async reviewReport(reportId: string, decision: ReportDecision, reviewerId: string): Promise<void> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException("Report not found");
    if (report.status !== PrismaReportStatus.PENDING) {
      throw new ConflictException("Report has already been reviewed");
    }

    const newStatus = decision === "RESOLVED" ? PrismaReportStatus.RESOLVED : PrismaReportStatus.REJECTED;

    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({
        where: { id: reportId },
        data: { status: newStatus, reviewedById: reviewerId, reviewedAt: new Date() },
      });
      if (decision !== "REJECTED") return;

      if (report.targetType === PrismaReportTargetType.USER && report.targetUserId) {
        const user = await tx.user.update({
          where: { id: report.targetUserId },
          data: { reportCount: { decrement: 1 } },
        });
        if (user.reportCount < this.blockThreshold && user.status === AccountStatus.DORMANT) {
          await tx.user.update({ where: { id: report.targetUserId }, data: { status: AccountStatus.ACTIVE } });
        }
      } else if (report.targetType === PrismaReportTargetType.PRODUCT && report.targetProductId) {
        const product = await tx.product.update({
          where: { id: report.targetProductId },
          data: { reportCount: { decrement: 1 } },
        });
        if (product.reportCount < this.blockThreshold && product.status === ProductStatus.BLOCKED) {
          await tx.product.update({ where: { id: report.targetProductId }, data: { status: ProductStatus.ACTIVE } });
        }
      }
    });
  }

  // Distinct from ProductService.remove: that one is seller-only (checks
  // sellerId ownership). This is the moderation path — any admin can remove
  // any product regardless of who owns it, independent of whether it was
  // ever auto-BLOCKED by the report threshold. Soft delete via the same
  // `deletedAt` column the seller-initiated delete uses, so it disappears
  // from list/detail/mine the same way.
  async deleteProduct(productId: string, adminId: string): Promise<void> {
    const product = await this.prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!product) throw new NotFoundException("Product not found");

    await this.prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: productId }, data: { deletedAt: new Date() } });

      // Any still-open reports against this product now have nothing left
      // to review — resolve them so they don't linger in the PENDING queue
      // pointing at a product that no longer exists.
      await tx.report.updateMany({
        where: { targetProductId: productId, status: PrismaReportStatus.PENDING },
        data: { status: PrismaReportStatus.RESOLVED, reviewedById: adminId, reviewedAt: new Date() },
      });
    });
  }
}
