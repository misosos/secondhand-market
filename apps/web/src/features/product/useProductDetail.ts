"use client";

import { useCallback, useEffect, useState } from "react";
import type { ProductDetail } from "@secondhand/types";
import { api } from "@/lib/api";

export function useProductDetail(id: string) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<ProductDetail>(`/products/${id}`, { skipAuth: true });
      setProduct(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to load product");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    reload();
  }, [reload]);

  return { product, isLoading, error, reload };
}
