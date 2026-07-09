"use client";

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
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 16 }}>거래 내역</h1>
      <AdminSectionNav />

      <ErrorMessage>{error}</ErrorMessage>
      {isLoading && <Spinner />}
      {!isLoading && items.length === 0 && <p className={styles.empty}>거래 내역이 없습니다.</p>}

      <ul className={styles.list}>
        {items.map((tx) => (
          <li key={tx.id} className={styles.card}>
            <div>
              <p className={styles.productName}>{tx.productName}</p>
              <p className={styles.meta}>
                {tx.buyer.username} → {tx.seller.username} · {new Date(tx.createdAt).toLocaleString()}
              </p>
            </div>
            <span className={styles.amount}>{tx.amount.toLocaleString()}원</span>
          </li>
        ))}
      </ul>

      {hasMore && (
        <button className={styles.loadMoreButton} onClick={loadMore} disabled={isLoadingMore}>
          {isLoadingMore ? "불러오는 중..." : "더 보기"}
        </button>
      )}
    </div>
  );
}
