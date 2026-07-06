import { IsIn } from "class-validator";
import type { ReportDecision } from "@secondhand/types";

export class ReviewReportDto {
  @IsIn(["RESOLVED", "REJECTED"])
  decision: ReportDecision;
}
