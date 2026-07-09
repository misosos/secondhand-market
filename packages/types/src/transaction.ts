import { CursorPaginationQuery } from "./pagination";

export interface TransactionDto {
  id: string;
  // Both null for a direct chat transfer — there's no product involved.
  productId: string | null;
  productName: string | null;
  buyer: { id: string; username: string };
  seller: { id: string; username: string };
  amount: number;
  createdAt: string;
}

export interface PurchaseRequest {
  productId: string;
}

export type TransactionListQuery = CursorPaginationQuery;
