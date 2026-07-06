import Link from "next/link";
import type { ProductSummary } from "@secondhand/types";
import styles from "./ProductCard.module.css";

export function ProductCard({ product }: { product: ProductSummary }) {
  return (
    <Link href={`/products/${product.id}`} className={styles.card}>
      <div className={styles.thumbnailWrap}>
        {product.thumbnailUrl ? (
          // Plain <img>, not next/image: product images come from an
          // arbitrary S3-compatible endpoint set at runtime via env var,
          // which next/image's remotePatterns can't be configured for
          // without a build-time-known domain list.
          <img className={styles.thumbnail} src={product.thumbnailUrl} alt={product.name} />
        ) : (
          <div className={styles.thumbnailPlaceholder}>No Image</div>
        )}
      </div>
      <div className={styles.body}>
        <p className={styles.name}>{product.name}</p>
        <p className={styles.price}>{product.price.toLocaleString()}원</p>
      </div>
    </Link>
  );
}
