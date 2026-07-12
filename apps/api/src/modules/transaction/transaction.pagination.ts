import { BadRequestException } from "@nestjs/common";
import { Prisma } from "@prisma/client";

interface DecodedCursor {
  createdAt: string;
  id: string;
}

// Same keyset pagination idea as chat.pagination.ts/product.pagination.ts:
// createdAt isn't unique on its own, id breaks ties. History always pages
// newest-first, so there's no configurable sort order to carry in the cursor.
export function encodeCursor(transaction: { id: string; createdAt: Date }): string {
  return Buffer.from(
    JSON.stringify({ createdAt: transaction.createdAt.toISOString(), id: transaction.id }),
  ).toString("base64url");
}

export function decodeCursor(cursor: string): DecodedCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      throw new Error("malformed cursor");
    }
    return parsed as DecodedCursor;
  } catch {
    throw new BadRequestException("Invalid cursor");
  }
}

export function buildSeekWhere(cursor: DecodedCursor): Prisma.TransactionWhereInput {
  const createdAt = new Date(cursor.createdAt);
  return {
    OR: [{ createdAt: { lt: createdAt } }, { AND: [{ createdAt }, { id: { lt: cursor.id } }] }],
  };
}
