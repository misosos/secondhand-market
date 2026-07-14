"use client";

import { useRouter } from "next/navigation";
import { use, useEffect } from "react";
import { ErrorMessage } from "@/components/common/ErrorMessage";
import { Spinner } from "@/components/common/Spinner";
import { ProductForm, type ProductFormValues } from "@/components/product/ProductForm";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { updateProduct } from "@/features/product/api";
import { useProductDetail } from "@/features/product/useProductDetail";

export default function EditProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, isLoading: isAuthLoading } = useRequireAuth();
  const { product, isLoading, error } = useProductDetail(id);
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthLoading && product && user && product.sellerId !== user.id) {
      router.replace(`/products/${id}`);
    }
  }, [isLoading, isAuthLoading, product, user, id, router]);

  if (isAuthLoading || isLoading || !user) return <Spinner />;
  if (error || !product) return <ErrorMessage>{error ?? "상품을 찾을 수 없습니다."}</ErrorMessage>;
  if (product.sellerId !== user.id) return <Spinner />;

  async function handleSubmit(values: ProductFormValues) {
    await updateProduct(product!.id, values);
    router.push(`/products/${product!.id}`);
  }

  return (
    <div>
      <h1 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 600, marginBottom: 20 }}>
        상품 수정
      </h1>
      <ProductForm
        initialValues={{
          name: product.name,
          description: product.description,
          price: product.price,
          imageUrls: product.images.map((image) => image.url),
        }}
        onSubmit={handleSubmit}
        submitLabel="저장하기"
      />
    </div>
  );
}
