"use client";

import { useState } from "react";
import { ReportStatus, type ReportDecision } from "@secondhand/types";
import { Button } from "@/components/common/Button";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useAdminReports } from "@/features/admin/useAdminReports";
import styles from "./page.module.css";

const TABS: { label: string; value: ReportStatus | "ALL" }[] = [
  { label: "대기중", value: ReportStatus.PENDING },
  { label: "승인됨", value: ReportStatus.RESOLVED },
  { label: "반려됨", value: ReportStatus.REJECTED },
  { label: "전체", value: "ALL" },
];

export default function AdminReportsPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const [tab, setTab] = useState<ReportStatus | "ALL">(ReportStatus.PENDING);
  const { reports, isLoading, error, review } = useAdminReports(tab);
  const [pendingActionId, setPendingActionId] = useState<string | null>(null);

  if (authLoading) return <Spinner />;

  async function handleReview(reportId: string, decision: ReportDecision) {
    setPendingActionId(reportId);
    try {
      await review(reportId, decision);
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>신고 관리</h1>

      <div className={styles.tabs}>
        {TABS.map((t) => (
          <button
            key={t.value}
            className={`${styles.tab} ${tab === t.value ? styles.tabActive : ""}`}
            onClick={() => setTab(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <ErrorMessage>{error}</ErrorMessage>
      {isLoading && <Spinner />}
      {!isLoading && !error && reports.length === 0 && <p className={styles.empty}>표시할 신고가 없습니다.</p>}

      <ul className={styles.list}>
        {reports.map((report) => (
          <li key={report.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <span>
                {report.targetType === "USER" ? "사용자" : "상품"} 신고 ·{" "}
                <span className={styles.targetLabel}>{report.target.label}</span> (상태: {report.target.status})
              </span>
              <span>{report.status}</span>
            </div>
            <p className={styles.reason}>{report.reason}</p>
            <p className={styles.meta}>
              신고자 {report.reporter.username} · {new Date(report.createdAt).toLocaleString()}
            </p>
            {report.status === ReportStatus.PENDING && (
              <div className={styles.actions}>
                <Button
                  variant="secondary"
                  disabled={pendingActionId === report.id}
                  onClick={() => handleReview(report.id, "RESOLVED")}
                >
                  신고 인정
                </Button>
                <Button
                  variant="danger"
                  disabled={pendingActionId === report.id}
                  onClick={() => handleReview(report.id, "REJECTED")}
                >
                  반려 (대상 복구)
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
