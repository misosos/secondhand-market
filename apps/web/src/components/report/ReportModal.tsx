"use client";

import { useState, type FormEvent } from "react";
import { ReportTargetType } from "@secondhand/types";
import { Button } from "@/components/common/Button";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { TextArea } from "@/components/common/TextArea";
import { useReport } from "@/features/report/useReport";
import styles from "./ReportModal.module.css";

interface ReportModalProps {
  targetType: ReportTargetType;
  targetId: string;
  onClose: () => void;
}

export function ReportModal({ targetType, targetId, onClose }: ReportModalProps) {
  const [reason, setReason] = useState("");
  const { submitReport, isSubmitting, error, success } = useReport();

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return;
    await submitReport(targetType, targetId, reason);
  }

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.panel} onClick={(e) => e.stopPropagation()}>
        <p className={styles.title}>{targetType === ReportTargetType.USER ? "사용자 신고" : "상품 신고"}</p>

        {success ? (
          <>
            <p className={styles.success}>신고가 접수되었습니다.</p>
            <div className={styles.actions}>
              <Button onClick={onClose}>닫기</Button>
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <TextArea
              label="신고 사유"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
            />
            <ErrorMessage>{error}</ErrorMessage>
            <div className={styles.actions}>
              <Button type="button" variant="secondary" onClick={onClose}>
                취소
              </Button>
              <Button type="submit" variant="danger" disabled={isSubmitting || !reason.trim()}>
                {isSubmitting ? "제출 중..." : "신고하기"}
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
