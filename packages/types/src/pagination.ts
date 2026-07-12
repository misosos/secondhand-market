export interface CursorPaginationQuery {
  cursor?: string;
  limit?: number;
}

export interface CursorPaginationResult<T> {
  items: T[];
  nextCursor: string | null;
}
