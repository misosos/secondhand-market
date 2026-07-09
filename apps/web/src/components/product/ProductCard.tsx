"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";
import type { ProductSummary } from "@secondhand/types";
import { navigateWithMorph, prefersReducedMotion, supportsViewTransitions } from "@/lib/viewTransition";
import styles from "./ProductCard.module.css";

export function ProductCard({ product }: { product: ProductSummary }) {
  const router = useRouter();

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (!supportsViewTransitions() || prefersReducedMotion()) return;
    event.preventDefault();
    navigateWithMorph(router, `/products/${product.id}`, `product-thumb-${product.id}`);
  }

  return (
    <Link href={`/products/${product.id}`} className={`${styles.card} squircle`} onClick={handleClick}>
      <div
        className={styles.thumbnailWrap}
        style={{ viewTransitionName: `product-thumb-${product.id}` } as React.CSSProperties}
      >
        {/* Plain <img>, not next/image: product images come from an
            arbitrary S3-compatible endpoint set at runtime via env var,
            which next/image's remotePatterns can't be configured for
            without a build-time-known domain list. */}
        {product.thumbnailUrl ? (
          <img className={styles.thumbnail} src={product.thumbnailUrl} alt={product.name} />
        ) : (
          <div className={styles.thumbnailPlaceholder}>No Image</div>
        )}
      </div>
      <div className={styles.body}>
        <p
          className={styles.name}
          style={{ viewTransitionName: `product-title-${product.id}` } as React.CSSProperties}
        >
          {product.name}
        </p>
        <p className={styles.price}>{product.price.toLocaleString()}원</p>
      </div>
    </Link>
  );
}
