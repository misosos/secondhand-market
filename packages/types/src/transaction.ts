import { CursorPaginationQuery } from "./pagination";

export interface TransactionDto {
  id: string;
  productId: string;
  productName: string;
  buyer: { id: string; username: string };
  seller: { id: string; username: string };
  amount: number;
  createdAt: string;
}

export interface PurchaseRequest {
  productId: string;
}

export type TransactionListQuery = CursorPaginationQuery;
