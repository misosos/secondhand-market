import { Body, Controller, Get, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../../common/guards/admin.guard";
import { AdminService } from "./admin.service";
import { AdminReportListQueryDto } from "./dto/admin-report-list-query.dto";
import { ReviewReportDto } from "./dto/review-report.dto";

@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("reports")
  listReports(@Query() query: AdminReportListQueryDto) {
    return this.adminService.listReports(query.status);
  }

  @Patch("reports/:id")
  async reviewReport(@Param("id") id: string, @Body() dto: ReviewReportDto) {
    await this.adminService.reviewReport(id, dto.decision);
    return { success: true };
  }
}
