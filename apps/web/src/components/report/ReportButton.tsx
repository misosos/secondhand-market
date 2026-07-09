import Link from "next/link";
import { Flag } from "lucide-react";
import type { ReportTargetType } from "@secondhand/types";
import { Button } from "@/components/common/Button";

interface ReportButtonProps {
  targetType: ReportTargetType;
  targetId: string;
  label?: string;
}

export function ReportButton({ targetType, targetId, label = "신고" }: ReportButtonProps) {
  return (
    <Link href={`/report?targetType=${targetType}&targetId=${targetId}`}>
      <Button variant="danger" icon={Flag}>{label}</Button>
    </Link>
  );
}
