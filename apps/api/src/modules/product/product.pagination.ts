import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { ProductSortBy, SortOrder } from "@secondhand/types";

interface DecodedCursor {
  value: string;
  id: string;
}

// Keyset ("seek method") pagination: the cursor carries the sort field's
// value plus the row id as a tiebreaker, since neither createdAt nor price
// is unique on its own. This is why Prisma's built-in `cursor` option
// doesn't fit here — it requires the cursor field(s) to be a unique/@@id
// constraint, which [status, createdAt] is not.
export function encodeCursor(
  item: { id: string; createdAt: Date; price: number },
  sortBy: ProductSortBy,
): string {
  const value = sortBy === "createdAt" ? item.createdAt.toISOString() : String(item.price);
  return Buffer.from(JSON.stringify({ value, id: item.id })).toString("base64url");
}

export function decodeCursor(cursor: string): DecodedCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof parsed.value !== "string" || typeof parsed.id !== "string") {
      throw new Error("malformed cursor");
    }
    return parsed as DecodedCursor;
  } catch {
    throw new BadRequestException("Invalid cursor");
  }
}

export function buildOrderBy(
  sortBy: ProductSortBy,
  order: SortOrder,
): Prisma.ProductOrderByWithRelationInput[] {
  // sortBy is a validated 2-value union at runtime, but a computed key
  // can't be statically checked against Prisma's exact input type — the
  // shape itself is correct, hence the cast.
  return [{ [sortBy]: order } as Prisma.ProductOrderByWithRelationInput, { id: order }];
}

export function buildSeekWhere(
  sortBy: ProductSortBy,
  order: SortOrder,
  cursor: DecodedCursor,
): Prisma.ProductWhereInput {
  const cmp = order === "desc" ? "lt" : "gt";
  const typedValue: string | number | Date =
    sortBy === "createdAt" ? new Date(cursor.value) : Number(cursor.value);

  // (sortField cmp value) OR (sortField == value AND id cmp cursor.id)
  return {
    OR: [
      { [sortBy]: { [cmp]: typedValue } },
      { AND: [{ [sortBy]: typedValue }, { id: { [cmp]: cursor.id } }] },
    ],
  } as Prisma.ProductWhereInput;
}
