import { IsEnum, IsOptional } from "class-validator";
import { ReportStatus } from "@secondhand/types";

export class AdminReportListQueryDto {
  @IsOptional()
  @IsEnum(ReportStatus)
  status?: ReportStatus;
}
