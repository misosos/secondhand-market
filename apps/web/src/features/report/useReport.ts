"use client";

import { useCallback, useState } from "react";
import { ReportTargetType } from "@secondhand/types";
import { api } from "@/lib/api";

export function useReport() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const submitReport = useCallback(async (targetType: ReportTargetType, targetId: string, reason: string) => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);
    try {
      await api.post("/reports", { targetType, targetId, reason });
      setSuccess(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to submit report");
    } finally {
      setIsSubmitting(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setSuccess(false);
  }, []);

  return { submitReport, isSubmitting, error, success, reset };
}
