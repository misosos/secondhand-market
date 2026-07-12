import { CursorPaginationQuery } from "./pagination";

// PENDING only ever applies to a chat transfer awaiting the recipient's
// 받기/거절 decision — product purchases are always created COMPLETED since
// there's no accept step for those.
export type TransactionStatus = "PENDING" | "COMPLETED" | "REJECTED";

export interface TransactionDto {
  id: string;
  // Both null for a direct chat transfer — there's no product involved.
  productId: string | null;
  productName: string | null;
  buyer: { id: string; username: string };
  seller: { id: string; username: string };
  amount: number;
  status: TransactionStatus;
  createdAt: string;
}

export interface PurchaseRequest {
  productId: string;
}

export type TransactionListQuery = CursorPaginationQuery;
