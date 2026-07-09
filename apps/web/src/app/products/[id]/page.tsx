"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Pencil, ShoppingBag, Trash2 } from "lucide-react";
import { ProductStatus, ReportTargetType } from "@secondhand/types";
import { Button } from "@/components/common/Button";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { ChatEntryButton } from "@/components/chat/ChatEntryButton";
import { ReportButton } from "@/components/report/ReportButton";
import { useAuth } from "@/features/auth/useAuth";
import { useProductDetail } from "@/features/product/useProductDetail";
import { deleteProduct, purchaseProduct } from "@/features/product/api";
import { ApiError } from "@/lib/api";
import styles from "./page.module.css";

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { user, refreshUser } = useAuth();
  const { product, isLoading, error, reload } = useProductDetail(params.id);
  const [activeImage, setActiveImage] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [purchaseError, setPurchaseError] = useState<string | null>(null);
  const router = useRouter();

  if (isLoading) return <Spinner />;
  if (error || !product) return <ErrorMessage>{error ?? "상품을 찾을 수 없습니다."}</ErrorMessage>;

  const isOwner = user?.id === product.sellerId;
  const isPurchasable = product.status === ProductStatus.ACTIVE;

  async function handleDelete() {
    if (!confirm("정말 삭제하시겠습니까?")) return;
    setIsDeleting(true);
    try {
      await deleteProduct(product!.id);
      router.push("/");
    } finally {
      setIsDeleting(false);
    }
  }

  async function handlePurchase() {
    if (!confirm(`${product!.price.toLocaleString()}원에 구매하시겠습니까?`)) return;
    setIsPurchasing(true);
    setPurchaseError(null);
    try {
      await purchaseProduct(product!.id);
      await Promise.all([reload(), refreshUser()]);
    } catch (err) {
      setPurchaseError(err instanceof ApiError ? err.message : "구매에 실패했습니다.");
    } finally {
      setIsPurchasing(false);
    }
  }

  return (
    <div className={styles.layout}>
      <div>
        <div
          className={`${styles.mainImageWrap} squircle`}
          style={{ viewTransitionName: `product-thumb-${product.id}` } as React.CSSProperties}
        >
          {product.images[activeImage] && (
            <img className={styles.mainImage} src={product.images[activeImage].url} alt={product.name} />
          )}
        </div>
        {product.images.length > 1 && (
          <div className={styles.thumbRow}>
            {product.images.map((image, index) => (
              <button
                key={image.id}
                className={`${styles.thumb} ${index === activeImage ? styles.thumbActive : ""}`}
                onClick={() => setActiveImage(index)}
              >
                <img src={image.url} alt="" />
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h1
          className={styles.name}
          style={{ viewTransitionName: `product-title-${product.id}` } as React.CSSProperties}
        >
          {product.name}
        </h1>

        <div className={`${styles.pricePanel} squircle`}>
          <div className={styles.priceRow}>
            <span>상품가</span>
            <span className={styles.val}>{product.price.toLocaleString()}원</span>
          </div>
          <div className={styles.priceRow}>
            <span>플랫폼 수수료</span>
            <span className={styles.val}>0원</span>
          </div>
          <div className={styles.priceRowTotal}>
            <span>최종 결제 금액</span>
            <span className={styles.val}>{product.price.toLocaleString()}원</span>
          </div>
          <p className={styles.priceFootnote}>
            {product.status === ProductStatus.SOLD
              ? "이미 판매 완료된 상품입니다."
              : product.status === ProductStatus.BLOCKED
                ? "신고 누적으로 비공개 처리된 상품입니다."
                : "거래 확정 전 언제든 취소할 수 있어요 · 숨겨진 수수료 없음"}
          </p>
        </div>

        <p className={styles.seller}>
          판매자:{" "}
          <Link href={`/users/${product.sellerId}`} style={{ textDecoration: "underline" }}>
            프로필 보기
          </Link>
        </p>
        <p className={styles.description}>{product.description}</p>

        <ErrorMessage>{purchaseError}</ErrorMessage>

        <div className={styles.actions}>
          {isOwner ? (
            <>
              <Link href={`/products/${product.id}/edit`}>
                <Button variant="secondary" icon={Pencil}>수정</Button>
              </Link>
              <Button variant="danger" icon={Trash2} onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "삭제 중..." : "삭제"}
              </Button>
            </>
          ) : (
            user && (
              <>
                {isPurchasable && (
                  <Button icon={ShoppingBag} onClick={handlePurchase} disabled={isPurchasing}>
                    {isPurchasing ? "구매 중..." : "구매하기"}
                  </Button>
                )}
                <ChatEntryButton peerId={product.sellerId} peerUsername="판매자" />
                <ReportButton targetType={ReportTargetType.PRODUCT} targetId={product.id} label="상품 신고" />
              </>
            )
          )}
        </div>
      </div>
    </div>
  );
}
