import { ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AccountStatus, ProductStatus, ReportStatus as PrismaReportStatus, ReportTargetType as PrismaReportTargetType } from "@prisma/client";
import { ReportTargetType as SharedReportTargetType } from "@secondhand/types";
import type { AdminReportDto, ReportDecision, ReportStatus as SharedReportStatus } from "@secondhand/types";
import { PrismaService } from "../../infra/prisma/prisma.service";

@Injectable()
export class AdminService {
  private readonly blockThreshold: number;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.blockThreshold = configService.get<number>("REPORT_BLOCK_THRESHOLD")!;
  }

  async listReports(status?: SharedReportStatus): Promise<AdminReportDto[]> {
    const reports = await this.prisma.report.findMany({
      where: status ? { status: status as unknown as PrismaReportStatus } : {},
      orderBy: { createdAt: "desc" },
      include: { reporter: true, targetUser: true, targetProduct: true },
    });

    return reports.map((report) => ({
      id: report.id,
      targetType: report.targetType as unknown as SharedReportTargetType,
      reason: report.reason,
      status: report.status as unknown as SharedReportStatus,
      createdAt: report.createdAt.toISOString(),
      reporter: { id: report.reporter.id, username: report.reporter.username },
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
  async reviewReport(reportId: string, decision: ReportDecision): Promise<void> {
    const report = await this.prisma.report.findUnique({ where: { id: reportId } });
    if (!report) throw new NotFoundException("Report not found");
    if (report.status !== PrismaReportStatus.PENDING) {
      throw new ConflictException("Report has already been reviewed");
    }

    const newStatus = decision === "RESOLVED" ? PrismaReportStatus.RESOLVED : PrismaReportStatus.REJECTED;

    await this.prisma.$transaction(async (tx) => {
      await tx.report.update({ where: { id: reportId }, data: { status: newStatus } });
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
}
