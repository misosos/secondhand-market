"use client";

import { useState } from "react";
import type { ProductSortBy, SortOrder } from "@secondhand/types";
import { ProductList } from "@/components/product/ProductList";
import { useProducts } from "@/features/product/useProducts";
import { ErrorMessage } from "@/components/common/ErrorMessage";
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
          <span className="eyebrow">중고거래</span>
          <h1 className={styles.heroHeadline}>
            물건은 새롭게,
            <br />
            <b>발견</b>은 더 쉽게.
          </h1>
          <p className={styles.heroSub}>믿을 수 있는 이웃에게서, 필요했던 물건을 합리적인 가격에.</p>
        </div>
      </div>

      <form
        className={styles.toolbar}
        onSubmit={(e) => {
          e.preventDefault();
          setKeyword(keywordInput.trim());
        }}
      >
        <input
          className={styles.searchInput}
          placeholder="상품명 또는 설명 검색"
          value={keywordInput}
          onChange={(e) => setKeywordInput(e.target.value)}
        />
        <select className={styles.select} value={`${sortBy}:${order}`} onChange={(e) => handleSortChange(e.target.value)}>
          <option value="createdAt:desc">최신순</option>
          <option value="createdAt:asc">오래된순</option>
          <option value="price:asc">낮은 가격순</option>
          <option value="price:desc">높은 가격순</option>
        </select>
      </form>

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
