"use client";

import { useCallback, useEffect, useState } from "react";
import type { CursorPaginationResult, ProductSortBy, ProductSummary, SortOrder } from "@secondhand/types";
import { api } from "@/lib/api";

interface UseProductsOptions {
  keyword?: string;
  sortBy?: ProductSortBy;
  order?: SortOrder;
}

export function useProducts({ keyword, sortBy, order }: UseProductsOptions) {
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildQuery = useCallback(
    (cursor?: string) => {
      const params = new URLSearchParams();
      if (keyword) params.set("keyword", keyword);
      if (sortBy) params.set("sortBy", sortBy);
      if (order) params.set("order", order);
      if (cursor) params.set("cursor", cursor);
      return params.toString();
    },
    [keyword, sortBy, order],
  );

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    api
      .get<CursorPaginationResult<ProductSummary>>(`/products?${buildQuery()}`, { skipAuth: true })
      .then((res) => {
        if (cancelled) return;
        setItems(res.items);
        setNextCursor(res.nextCursor);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load products");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [buildQuery]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    try {
      const res = await api.get<CursorPaginationResult<ProductSummary>>(`/products?${buildQuery(nextCursor)}`, {
        skipAuth: true,
      });
      setItems((prev) => [...prev, ...res.items]);
      setNextCursor(res.nextCursor);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load more products");
    } finally {
      setIsLoadingMore(false);
    }
  }, [buildQuery, nextCursor, isLoadingMore]);

  return { items, hasMore: nextCursor !== null, isLoading, isLoadingMore, error, loadMore };
}
