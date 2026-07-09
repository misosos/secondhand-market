"use client";

import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { useAuth } from "@/features/auth/useAuth";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useMyTransactions } from "@/features/transaction/useMyTransactions";
import styles from "./page.module.css";

export default function MyTransactionsPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const { user } = useAuth();
  const { items, isLoading, isLoadingMore, hasMore, error, loadMore } = useMyTransactions();

  if (authLoading || !user) return <Spinner />;

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>거래 내역</h1>
      <p style={{ color: "var(--color-muted)", fontSize: 13, marginBottom: 20 }}>
        현재 잔액: {user.balance.toLocaleString()}원
      </p>

      <ErrorMessage>{error}</ErrorMessage>
      {isLoading && <Spinner />}
      {!isLoading && items.length === 0 && <p className={styles.empty}>거래 내역이 없습니다.</p>}

      <ul className={styles.list}>
        {items.map((tx) => {
          const isSale = tx.seller.id === user.id;
          return (
            <li key={tx.id} className={styles.card}>
              <div>
                <p className={styles.productName}>
                  {tx.productName ?? "채팅 송금"}
                  {tx.status === "PENDING" && " (대기중)"}
                  {tx.status === "REJECTED" && " (거절됨·환불)"}
                </p>
                <p className={styles.meta}>
                  {tx.productName
                    ? isSale
                      ? `구매자 ${tx.buyer.username}`
                      : `판매자 ${tx.seller.username}`
                    : isSale
                      ? `보낸사람 ${tx.buyer.username}`
                      : `받는사람 ${tx.seller.username}`}{" "}
                  · {new Date(tx.createdAt).toLocaleString()}
                </p>
              </div>
              <span className={`${styles.amount} ${isSale ? styles.received : styles.sent}`}>
                {isSale ? "+" : "-"}
                {tx.amount.toLocaleString()}원
              </span>
            </li>
          );
        })}
      </ul>

      {hasMore && (
        <button className={styles.loadMoreButton} onClick={loadMore} disabled={isLoadingMore}>
          {isLoadingMore ? "불러오는 중..." : "더 보기"}
        </button>
      )}
    </div>
  );
}
