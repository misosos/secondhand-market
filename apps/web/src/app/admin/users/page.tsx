"use client";

import { useState } from "react";
import { Users, UserCheck, UserX } from "lucide-react";
import { AccountStatus } from "@secondhand/types";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { AdminSectionNav } from "@/components/admin/AdminSectionNav";
import { useAuth } from "@/features/auth/useAuth";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useAdminUsers } from "@/features/admin/useAdminUsers";
import styles from "./page.module.css";

const TABS: { label: string; value: AccountStatus | "ALL" }[] = [
  { label: "전체", value: "ALL" },
  { label: "활성", value: AccountStatus.ACTIVE },
  { label: "휴면", value: AccountStatus.DORMANT },
];

export default function AdminUsersPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const { user: currentUser } = useAuth();
  const [tab, setTab] = useState<AccountStatus | "ALL">("ALL");
  const { users, isLoading, error, setUserStatus } = useAdminUsers(tab);
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (authLoading) return <Spinner />;

  async function handleToggleStatus(userId: string, currentStatus: AccountStatus) {
    const nextStatus = currentStatus === AccountStatus.ACTIVE ? AccountStatus.DORMANT : AccountStatus.ACTIVE;
    const label = nextStatus === AccountStatus.DORMANT ? "휴면 처리" : "휴면 해제";
    if (!confirm(`이 유저를 ${label}하시겠습니까?`)) return;
    setPendingId(userId);
    try {
      await setUserStatus(userId, nextStatus);
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>유저 관리</h1>
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
      {!isLoading && !error && users.length === 0 && <EmptyState icon={Users} message="표시할 유저가 없습니다." />}

      <ul className={styles.list}>
        {users.map((u) => (
          <li key={u.id} className={styles.card}>
            <div>
              <span className={styles.username}>{u.username}</span>
              <span
                className={`${styles.statusBadge} ${
                  u.status === AccountStatus.ACTIVE ? styles.statusActive : styles.statusDormant
                }`}
              >
                {u.status === AccountStatus.ACTIVE ? "활성" : "휴면"}
              </span>
              <p className={styles.meta}>
                잔액 {u.balance.toLocaleString()}원 · 누적신고 {u.reportCount}건 · {u.role} ·{" "}
                {new Date(u.createdAt).toLocaleDateString()} 가입
              </p>
            </div>
            {u.id === currentUser?.id ? (
              <span className={styles.selfNotice} title="자기 자신의 계정 상태는 다른 관리자만 변경할 수 있어요">
                본인 계정
              </span>
            ) : (
              <Button
                variant={u.status === AccountStatus.ACTIVE ? "danger" : "secondary"}
                icon={u.status === AccountStatus.ACTIVE ? UserX : UserCheck}
                disabled={pendingId === u.id}
                onClick={() => handleToggleStatus(u.id, u.status)}
              >
                {u.status === AccountStatus.ACTIVE ? "휴면 처리" : "휴면 해제"}
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
