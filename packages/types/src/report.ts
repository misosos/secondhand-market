import { ReportStatus, ReportTargetType } from "./enums";

export interface CreateReportRequest {
  targetType: ReportTargetType;
  targetId: string;
  reason: string;
}

export interface ReportDto {
  id: string;
  targetType: ReportTargetType;
  reason: string;
  status: ReportStatus;
  createdAt: string;
}
