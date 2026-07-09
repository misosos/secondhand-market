import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Query, UseGuards } from "@nestjs/common";
import { AdminGuard } from "../../common/guards/admin.guard";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { TransactionListQueryDto } from "../transaction/dto/transaction-list-query.dto";
import { AdminService } from "./admin.service";
import { AdminReportListQueryDto } from "./dto/admin-report-list-query.dto";
import { AdminUserListQueryDto } from "./dto/admin-user-list-query.dto";
import { ReviewReportDto } from "./dto/review-report.dto";
import { SetUserStatusDto } from "./dto/set-user-status.dto";

@UseGuards(AdminGuard)
@Controller("admin")
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get("reports")
  listReports(@Query() query: AdminReportListQueryDto) {
    return this.adminService.listReports(query.status);
  }

  @Patch("reports/:id")
  async reviewReport(
    @CurrentUser("sub") reviewerId: string,
    @Param("id") id: string,
    @Body() dto: ReviewReportDto,
  ) {
    await this.adminService.reviewReport(id, dto.decision, reviewerId);
    return { success: true };
  }

  @Delete("products/:id")
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteProduct(@CurrentUser("sub") adminId: string, @Param("id") id: string) {
    await this.adminService.deleteProduct(id, adminId);
  }

  @Get("users")
  listUsers(@Query() query: AdminUserListQueryDto) {
    return this.adminService.listUsers(query.status);
  }

  @Patch("users/:id/status")
  async setUserStatus(
    @CurrentUser("sub") adminId: string,
    @Param("id") id: string,
    @Body() dto: SetUserStatusDto,
  ) {
    await this.adminService.setUserStatus(id, dto.status, adminId);
    return { success: true };
  }

  @Get("transactions")
  listTransactions(@Query() query: TransactionListQueryDto) {
    return this.adminService.listTransactions(query.cursor, query.limit);
  }
}
