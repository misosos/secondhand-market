"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductSummary } from "@secondhand/types";
import { api } from "@/lib/api";

// Unpaginated: this is one seller's own listings, not the full marketplace,
// so it stays a small bounded list unlike useProducts()'s cursor paging.
export function useMyProducts() {
  const [items, setItems] = useState<ProductSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await api.get<ProductSummary[]>("/products/mine");
      setItems(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "내 상품 목록을 불러오지 못했습니다.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { items, isLoading, error, refresh };
}
