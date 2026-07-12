"use client";

import { useCallback, useEffect, useState } from "react";
import { ReportStatus, type AdminReportDto, type ReportDecision } from "@secondhand/types";
import { api, ApiError } from "@/lib/api";

export function useAdminReports(status: ReportStatus | "ALL") {
  const [reports, setReports] = useState<AdminReportDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const query = status === "ALL" ? "" : `?status=${status}`;
      const result = await api.get<AdminReportDto[]>(`/admin/reports${query}`);
      setReports(result);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "신고 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const review = useCallback(
    async (reportId: string, decision: ReportDecision) => {
      await api.patch(`/admin/reports/${reportId}`, { decision });
      // Re-fetch rather than splice the item out locally: the target's
      // reportCount/status may also have changed server-side (see
      // AdminService.reviewReport), which this list doesn't otherwise show.
      await refresh();
    },
    [refresh],
  );

  const removeProduct = useCallback(
    async (productId: string) => {
      await api.delete(`/admin/products/${productId}`);
      // Deleting the product also auto-resolves any PENDING reports against
      // it server-side (see AdminService.deleteProduct), so refetch rather
      // than just dropping this one row.
      await refresh();
    },
    [refresh],
  );

  return { reports, isLoading, error, review, removeProduct };
}
