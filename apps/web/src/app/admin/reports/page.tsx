"use client";

import { useState } from "react";
import { Check, Flag, Trash2, X } from "lucide-react";
import { ReportStatus, ReportTargetType, type ReportDecision } from "@secondhand/types";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { AdminSectionNav } from "@/components/admin/AdminSectionNav";
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
  const { reports, isLoading, error, review, removeProduct } = useAdminReports(tab);
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

  async function handleDeleteProduct(reportId: string, productId: string) {
    if (!confirm("이 상품을 삭제하시겠습니까? 되돌릴 수 없습니다.")) return;
    setPendingActionId(reportId);
    try {
      await removeProduct(productId);
    } finally {
      setPendingActionId(null);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>신고 관리</h1>
      <AdminSectionNav />

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
      {!isLoading && !error && reports.length === 0 && <EmptyState icon={Flag} message="표시할 신고가 없습니다." />}

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
            {report.reviewedBy && report.reviewedAt && (
              <p className={styles.meta}>
                처리자 {report.reviewedBy.username} · {new Date(report.reviewedAt).toLocaleString()}
              </p>
            )}
            <div className={styles.actions}>
              {report.status === ReportStatus.PENDING && (
                <>
                  <Button
                    variant="secondary"
                    icon={Check}
                    disabled={pendingActionId === report.id}
                    onClick={() => handleReview(report.id, "RESOLVED")}
                  >
                    신고 인정
                  </Button>
                  <Button
                    variant="danger"
                    icon={X}
                    disabled={pendingActionId === report.id}
                    onClick={() => handleReview(report.id, "REJECTED")}
                  >
                    반려 (대상 복구)
                  </Button>
                </>
              )}
              {report.targetType === ReportTargetType.PRODUCT && (
                <Button
                  variant="danger"
                  icon={Trash2}
                  disabled={pendingActionId === report.id}
                  onClick={() => handleDeleteProduct(report.id, report.target.id)}
                >
                  상품 삭제
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
