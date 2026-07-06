"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ReportTargetType } from "@secondhand/types";
import { Button } from "@/components/common/Button";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { ChatEntryButton } from "@/components/chat/ChatEntryButton";
import { ReportButton } from "@/components/report/ReportButton";
import { useAuth } from "@/features/auth/useAuth";
import { useProductDetail } from "@/features/product/useProductDetail";
import { deleteProduct } from "@/features/product/api";
import styles from "./page.module.css";

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { user } = useAuth();
  const { product, isLoading, error } = useProductDetail(params.id);
  const [activeImage, setActiveImage] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  if (isLoading) return <Spinner />;
  if (error || !product) return <ErrorMessage>{error ?? "상품을 찾을 수 없습니다."}</ErrorMessage>;

  const isOwner = user?.id === product.sellerId;

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
          <p className={styles.priceFootnote}>거래 확정 전 언제든 취소할 수 있어요 · 숨겨진 수수료 없음</p>
        </div>

        <p className={styles.seller}>
          판매자:{" "}
          <Link href={`/users/${product.sellerId}`} style={{ textDecoration: "underline" }}>
            프로필 보기
          </Link>
        </p>
        <p className={styles.description}>{product.description}</p>

        <div className={styles.actions}>
          {isOwner ? (
            <>
              <Link href={`/products/${product.id}/edit`}>
                <Button variant="secondary">수정</Button>
              </Link>
              <Button variant="danger" onClick={handleDelete} disabled={isDeleting}>
                {isDeleting ? "삭제 중..." : "삭제"}
              </Button>
            </>
          ) : (
            user && (
              <>
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
