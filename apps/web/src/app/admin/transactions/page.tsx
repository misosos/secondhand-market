"use client";

import { ChevronDown, Receipt } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { AdminSectionNav } from "@/components/admin/AdminSectionNav";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useAdminTransactions } from "@/features/admin/useAdminTransactions";
import styles from "./page.module.css";

export default function AdminTransactionsPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const { items, isLoading, isLoadingMore, hasMore, error, loadMore } = useAdminTransactions();

  if (authLoading) return <Spinner />;

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, marginBottom: 16 }}>
        거래 내역
      </h1>
      <AdminSectionNav />

      <ErrorMessage>{error}</ErrorMessage>
      {isLoading && <Spinner />}
      {!isLoading && items.length === 0 && <EmptyState icon={Receipt} message="거래 내역이 없습니다." />}

      <ul className={styles.list}>
        {items.map((tx) => (
          <li key={tx.id} className={styles.card}>
            <div>
              <p className={styles.productName}>
                {tx.productName ?? "채팅 송금"}
                {tx.status === "PENDING" && " (대기중)"}
                {tx.status === "REJECTED" && " (거절됨·환불)"}
              </p>
              <p className={styles.meta}>
                {tx.buyer.username} → {tx.seller.username} · {new Date(tx.createdAt).toLocaleString()}
              </p>
            </div>
            <span className={`${styles.amount} ${tx.status !== "COMPLETED" ? styles.unsettled : ""}`}>
              {tx.amount.toLocaleString()}원
            </span>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button className={styles.loadMoreButton} onClick={loadMore} disabled={isLoadingMore}>
          <ChevronDown size={14} strokeWidth={2.25} aria-hidden />
          {isLoadingMore ? "불러오는 중..." : "더 보기"}
        </button>
      )}
    </div>
  );
}
