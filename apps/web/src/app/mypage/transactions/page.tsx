"use client";

import { ChevronDown, Receipt } from "lucide-react";
import { EmptyState } from "@/components/common/EmptyState";
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
      {!isLoading && items.length === 0 && <EmptyState icon={Receipt} message="거래 내역이 없습니다." />}

      <ul className={styles.list}>
        {items.map((tx) => {
          const isSale = tx.seller.id === user.id;
          // A chat transfer's escrow hold means the recipient (seller side)
          // never actually has the money until COMPLETED — showing "+" for
          // a still-PENDING or REJECTED-and-refunded one would claim a
          // deposit that never happened. Likewise a REJECTED transfer nets
          // back to zero for the sender, so it gets no sign either — only
          // the sender's side of a still-PENDING hold ("already left my
          // balance") and any COMPLETED row show a sign at all.
          const sign =
            tx.status === "REJECTED" ? null : tx.status === "PENDING" && isSale ? null : isSale ? "+" : "-";
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
              <span
                className={`${styles.amount} ${sign === "+" ? styles.received : sign === "-" ? styles.sent : ""}`}
              >
                {sign}
                {tx.amount.toLocaleString()}원
              </span>
            </li>
          );
        })}
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
