"use client";

import Link from "next/link";
import { useState } from "react";
import { Package, Pencil, Plus, Trash2 } from "lucide-react";
import { ProductStatus } from "@secondhand/types";
import { Button } from "@/components/common/Button";
import { EmptyState } from "@/components/common/EmptyState";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { useMyProducts } from "@/features/product/useMyProducts";
import { deleteProduct } from "@/features/product/api";
import styles from "./page.module.css";

const STATUS_LABEL: Partial<Record<ProductStatus, string>> = {
  [ProductStatus.BLOCKED]: "차단됨",
  [ProductStatus.SOLD]: "판매완료",
};

export default function MyProductsPage() {
  const { isLoading: authLoading } = useRequireAuth();
  const { items, isLoading, error, refresh } = useMyProducts();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  if (authLoading) return <Spinner />;

  async function handleDelete(id: string) {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setDeletingId(id);
    try {
      await deleteProduct(id);
      await refresh();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600 }}>내 상품 관리</h1>
        <Link href="/products/new">
          <Button variant="secondary" icon={Plus}>상품 등록</Button>
        </Link>
      </div>

      <ErrorMessage>{error}</ErrorMessage>
      {isLoading && <Spinner />}
      {!isLoading && items.length === 0 && <EmptyState icon={Package} message="등록한 상품이 없습니다." />}

      <div className={styles.grid}>
        {items.map((product) => {
          const statusLabel = STATUS_LABEL[product.status];
          // A BLOCKED listing is hidden from the public detail endpoint
          // even for its owner (see ProductService.findDetail), so it can
          // only be deleted here, not viewed/edited.
          const canOpen = product.status !== ProductStatus.BLOCKED;

          return (
            <div key={product.id} className={styles.card}>
              {canOpen ? (
                <Link href={`/products/${product.id}`} className={styles.thumbnailLink}>
                  <div className={styles.thumbnailWrap}>
                    {statusLabel && <span className={`stamp ${styles.statusBadge}`}>{statusLabel}</span>}
                    {product.thumbnailUrl ? (
                      <img className={styles.thumbnail} src={product.thumbnailUrl} alt={product.name} />
                    ) : (
                      <div className={styles.thumbnailPlaceholder}>No Image</div>
                    )}
                  </div>
                </Link>
              ) : (
                <div className={styles.thumbnailWrap}>
                  {statusLabel && <span className={`stamp ${styles.statusBadge}`}>{statusLabel}</span>}
                  {product.thumbnailUrl ? (
                    <img className={styles.thumbnail} src={product.thumbnailUrl} alt={product.name} />
                  ) : (
                    <div className={styles.thumbnailPlaceholder}>No Image</div>
                  )}
                </div>
              )}

              <div className={styles.body}>
                <p className={styles.name}>{product.name}</p>
                <p className={`priceTag ${styles.price}`}>{product.price.toLocaleString()}원</p>
                <div className={styles.actions}>
                  {canOpen && (
                    <Link href={`/products/${product.id}/edit`}>
                      <Button variant="secondary" icon={Pencil}>수정</Button>
                    </Link>
                  )}
                  <Button
                    variant="danger"
                    icon={Trash2}
                    disabled={deletingId === product.id}
                    onClick={() => handleDelete(product.id)}
                  >
                    삭제
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
