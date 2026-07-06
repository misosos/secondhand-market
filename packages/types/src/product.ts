import { ProductStatus } from "./enums";
import { CursorPaginationQuery } from "./pagination";

export interface ProductImageDto {
  id: string;
  url: string;
  sortOrder: number;
}

export interface ProductSummary {
  id: string;
  name: string;
  price: number;
  status: ProductStatus;
  thumbnailUrl: string | null;
  createdAt: string;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  images: ProductImageDto[];
  sellerId: string;
}

export type ProductSortBy = "createdAt" | "price";
export type SortOrder = "asc" | "desc";

export interface ProductListQuery extends CursorPaginationQuery {
  keyword?: string;
  sortBy?: ProductSortBy;
  order?: SortOrder;
}

export interface CreateProductRequest {
  name: string;
  description: string;
  price: number;
  imageUrls: string[];
}

export interface UpdateProductRequest {
  name?: string;
  description?: string;
  price?: number;
  imageUrls?: string[];
}

export interface PresignedUploadRequest {
  fileName: string;
  contentType: string;
}

export interface PresignedUploadResponse {
  uploadUrl: string;
  fileUrl: string;
}
