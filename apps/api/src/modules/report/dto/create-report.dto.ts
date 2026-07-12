import { IsEnum, IsNotEmpty, IsString, IsUUID, Length } from "class-validator";
import { ReportTargetType } from "@secondhand/types";
import { SanitizeHtml } from "../../../common/decorators/sanitize-html.decorator";
import { REPORT_REASON_MAX_LENGTH } from "../report.constants";

export class CreateReportDto {
  @IsEnum(ReportTargetType)
  targetType: ReportTargetType;

  @IsUUID()
  targetId: string;

  @IsString()
  @IsNotEmpty()
  @Length(1, REPORT_REASON_MAX_LENGTH)
  @SanitizeHtml()
  reason: string;
}
