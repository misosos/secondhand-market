"use client";

import { ChevronDown, Package } from "lucide-react";
import type { ProductSummary } from "@secondhand/types";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { Spinner } from "@/components/common/Spinner";
import { ProductCard } from "./ProductCard";
import styles from "./ProductList.module.css";

interface ProductListProps {
  items: ProductSummary[];
  isLoading: boolean;
  isLoadingMore: boolean;
  hasMore: boolean;
  onLoadMore: () => void;
}

export function ProductList({ items, isLoading, isLoadingMore, hasMore, onLoadMore }: ProductListProps) {
  if (isLoading) {
    return <Spinner />;
  }

  if (items.length === 0) {
    return <EmptyState icon={Package} message="등록된 상품이 없습니다." />;
  }

  return (
    <>
      <div className={styles.grid}>
        {items.map((product) => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
      {hasMore && (
        <div className={styles.loadMoreWrap}>
          <Button variant="secondary" icon={ChevronDown} onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "불러오는 중..." : "더 보기"}
          </Button>
        </div>
      )}
    </>
  );
}
