import { Body, Controller, Post } from "@nestjs/common";
import { Throttle } from "@nestjs/throttler";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { CreateReportDto } from "./dto/create-report.dto";
import { REPORT_THROTTLE } from "./report.constants";
import { ReportService } from "./report.service";

@Controller("reports")
export class ReportController {
  constructor(private readonly reportService: ReportService) {}

  @Throttle({ default: REPORT_THROTTLE })
  @Post()
  create(@CurrentUser("sub") reporterId: string, @Body() dto: CreateReportDto) {
    return this.reportService.create(reporterId, dto);
  }
}
