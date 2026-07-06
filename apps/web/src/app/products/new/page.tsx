"use client";

import { useRouter } from "next/navigation";
import { ProductForm, type ProductFormValues } from "@/components/product/ProductForm";
import { Spinner } from "@/components/common/Spinner";
import { useRequireAuth } from "@/features/auth/useRequireAuth";
import { createProduct } from "@/features/product/api";

export default function NewProductPage() {
  const { user, isLoading } = useRequireAuth();
  const router = useRouter();

  if (isLoading || !user) {
    return <Spinner />;
  }

  async function handleSubmit(values: ProductFormValues) {
    const product = await createProduct(values);
    router.push(`/products/${product.id}`);
  }

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 20 }}>상품 등록</h1>
      <ProductForm onSubmit={handleSubmit} submitLabel="등록하기" />
    </div>
  );
}
