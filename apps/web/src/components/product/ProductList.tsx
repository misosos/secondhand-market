"use client";

import type { ProductSummary } from "@secondhand/types";
import { Button } from "@/components/common/Button";
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
    return <p className={styles.empty}>등록된 상품이 없습니다.</p>;
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
          <Button variant="secondary" onClick={onLoadMore} disabled={isLoadingMore}>
            {isLoadingMore ? "불러오는 중..." : "더 보기"}
          </Button>
        </div>
      )}
    </>
  );
}
