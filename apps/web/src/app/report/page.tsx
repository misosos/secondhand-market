"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Flag, X } from "lucide-react";
import { ReportTargetType } from "@secondhand/types";
import { Button } from "@/components/common/Button";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { FormCard } from "@/components/common/FormCard";
import { Spinner } from "@/components/common/Spinner";
import { TextArea } from "@/components/common/TextArea";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useReport } from "@/features/report/useReport";

function ReportPageContent() {
  const { isLoading: authLoading } = useRequireAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reason, setReason] = useState("");
  const { submitReport, isSubmitting, error, success } = useReport();

  if (authLoading) return <Spinner />;

  const targetTypeParam = searchParams.get("targetType");
  const targetId = searchParams.get("targetId");
  const targetType =
    targetTypeParam === ReportTargetType.USER || targetTypeParam === ReportTargetType.PRODUCT
      ? (targetTypeParam as ReportTargetType)
      : null;

  if (!targetType || !targetId) {
    return <ErrorMessage>잘못된 신고 대상입니다.</ErrorMessage>;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!reason.trim()) return;
    await submitReport(targetType!, targetId!, reason);
  }

  return (
    <div style={{ maxWidth: 420 }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
        {targetType === ReportTargetType.USER ? "사용자 신고" : "상품 신고"}
      </h1>

      {success ? (
        <FormCard>
          <p style={{ marginBottom: 16 }}>신고가 접수되었습니다.</p>
          <Button icon={ArrowLeft} onClick={() => router.back()}>돌아가기</Button>
        </FormCard>
      ) : (
        <FormCard>
          <form onSubmit={handleSubmit}>
            <TextArea
              label="신고 사유"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={5}
              required
            />
            <ErrorMessage>{error}</ErrorMessage>
            <div style={{ display: "flex", gap: 8 }}>
              <Button type="button" variant="secondary" icon={X} onClick={() => router.back()}>
                취소
              </Button>
              <Button type="submit" variant="danger" icon={Flag} disabled={isSubmitting || !reason.trim()}>
                {isSubmitting ? "제출 중..." : "신고하기"}
              </Button>
            </div>
          </form>
        </FormCard>
      )}
    </div>
  );
}

export default function ReportPage() {
  return (
    <Suspense fallback={<Spinner />}>
      <ReportPageContent />
    </Suspense>
  );
}
