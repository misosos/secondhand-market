"use client";

import { useState } from "react";
import type { ReportTargetType } from "@secondhand/types";
import { Button } from "@/components/common/Button";
import { ReportModal } from "./ReportModal";

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
}

export function ReportButton({ targetType, targetId, label = "신고" }: ReportButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="danger" onClick={() => setIsOpen(true)}>
        {label}
      </Button>
      {isOpen && <ReportModal targetType={targetType} targetId={targetId} onClose={() => setIsOpen(false)} />}
    </>
  );
}
