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

// The two outcomes an admin can record for a PENDING report; anything else
// stays PENDING until reviewed.
export type ReportDecision = "RESOLVED" | "REJECTED";

export interface ReviewReportRequest {
  decision: ReportDecision;
}

export interface AdminReportDto extends ReportDto {
  reporter: { id: string; username: string };
  target: {
    type: ReportTargetType;
    id: string;
    label: string;
    status: string;
  };
}
