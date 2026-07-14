"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import type { ProductSortBy, SortOrder } from "@secondhand/types";
import { ProductList } from "@/components/product/ProductList";
import { useProducts } from "@/features/product/useProducts";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Logo } from "@/components/common/Logo";
import { Select } from "@/components/common/Select";
import styles from "./page.module.css";

export default function HomePage() {
  const [keywordInput, setKeywordInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [sortBy, setSortBy] = useState<ProductSortBy>("createdAt");
  const [order, setOrder] = useState<SortOrder>("desc");

  const { items, isLoading, isLoadingMore, hasMore, error, loadMore } = useProducts({ keyword, sortBy, order });

  function handleSortChange(value: string) {
    const [nextSortBy, nextOrder] = value.split(":") as [ProductSortBy, SortOrder];
    setSortBy(nextSortBy);
    setOrder(nextOrder);
  }

  return (
    <div>
      <div className={styles.hero}>
        <div className={styles.heroInner}>
          <div className={styles.heroText}>
            <span className={styles.heroBrand}>
              <Logo size={22} />
              중고거래
            </span>
            <h1 className={styles.heroHeadline}>
              쓰던 물건에,
              <br />
              <b>새 가격표</b>를.
            </h1>
            <p className={styles.heroSub}>필요 없는 건 팔고, 필요한 건 싸게 사요.</p>

            <form
              className={styles.toolbar}
              onSubmit={(e) => {
                e.preventDefault();
                setKeyword(keywordInput.trim());
              }}
            >
              <div className={styles.searchWrap}>
                <Search size={16} strokeWidth={2} className={styles.searchIcon} aria-hidden />
                <input
                  className={styles.searchInput}
                  placeholder="상품명 또는 설명 검색"
                  value={keywordInput}
                  onChange={(e) => setKeywordInput(e.target.value)}
                />
              </div>
              <Select value={`${sortBy}:${order}`} onChange={(e) => handleSortChange(e.target.value)}>
                <option value="createdAt:desc">최신순</option>
                <option value="createdAt:asc">오래된순</option>
                <option value="price:asc">낮은 가격순</option>
                <option value="price:desc">높은 가격순</option>
              </Select>
            </form>
          </div>

          {/* The signature: a physical price tag with the old price struck
              through and a new one written in — the headline made literal. */}
          <div className={`${styles.heroTag} tagShape`} aria-hidden>
            <span className={styles.heroTagOld}>32,000원</span>
            <span className={styles.heroTagNew}>14,000원</span>
            <span className={styles.heroTagLabel}>almost new · 직거래</span>
          </div>
        </div>
      </div>

      <ErrorMessage>{error}</ErrorMessage>

      <ProductList
        items={items}
        isLoading={isLoading}
        isLoadingMore={isLoadingMore}
        hasMore={hasMore}
        onLoadMore={loadMore}
      />
    </div>
  );
}
