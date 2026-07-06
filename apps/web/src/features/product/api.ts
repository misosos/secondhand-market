import type { CreateProductRequest, PresignedUploadResponse, ProductDetail, UpdateProductRequest } from "@secondhand/types";
import { api } from "@/lib/api";

export function createProduct(dto: CreateProductRequest): Promise<ProductDetail> {
  return api.post<ProductDetail>("/products", dto);
}

export function updateProduct(id: string, dto: UpdateProductRequest): Promise<ProductDetail> {
  return api.patch<ProductDetail>(`/products/${id}`, dto);
}

export function deleteProduct(id: string): Promise<void> {
  return api.delete<void>(`/products/${id}`);
}

function requestPresignedUpload(fileName: string, contentType: string): Promise<PresignedUploadResponse> {
  return api.post<PresignedUploadResponse>("/products/uploads/presigned", { fileName, contentType });
}

// Presigned PUT flow: ask the API for a signed URL, then upload the file
// bytes directly to the object store (never through our own server).
export async function uploadProductImage(file: File): Promise<string> {
  const { uploadUrl, fileUrl } = await requestPresignedUpload(file.name, file.type);

  const putRes = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "Content-Type": file.type },
    body: file,
  });

  if (!putRes.ok) {
    throw new Error("Image upload failed");
  }

  return fileUrl;
}
