"use client";

import { useCallback, useEffect, useState } from "react";
import type { CursorPaginationResult, TransactionDto } from "@secondhand/types";
import { api } from "@/lib/api";

export function useMyTransactions() {
  const [items, setItems] = useState<TransactionDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get<CursorPaginationResult<TransactionDto>>("/transactions/mine")
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setNextCursor(res.nextCursor);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "거래 내역을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await api.get<CursorPaginationResult<TransactionDto>>(
        `/transactions/mine?cursor=${encodeURIComponent(nextCursor)}`,
      );
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "거래 내역을 더 불러오지 못했습니다.");
    } finally {
      setIsLoadingMore(false);
    }
  }, [nextCursor, isLoadingMore]);

  return { items, hasMore: nextCursor !== null, isLoading, isLoadingMore, error, loadMore };
}
