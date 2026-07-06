import { WsException } from "@nestjs/websockets";
import { Prisma } from "@prisma/client";

interface DecodedCursor {
  createdAt: string;
  id: string;
}

// Same keyset idea as product.pagination.ts (createdAt isn't unique on its
// own, id breaks ties) but kept separate rather than shared/generalized —
// the Prisma where/orderBy input types differ per model, and this is only
// ~15 lines.
export function encodeCursor(message: { id: string; createdAt: Date }): string {
  return Buffer.from(JSON.stringify({ createdAt: message.createdAt.toISOString(), id: message.id })).toString(
    "base64url",
  );
}

export function decodeCursor(cursor: string): DecodedCursor {
  try {
    const parsed = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8"));
    if (typeof parsed.createdAt !== "string" || typeof parsed.id !== "string") {
      throw new Error("malformed cursor");
    }
    return parsed as DecodedCursor;
  } catch {
    throw new WsException("Invalid cursor");
  }
}

// History always pages backwards in time (newest-first, then older on
// scroll-up), so unlike product listing there's no configurable sort order.
export function buildSeekWhere(cursor: DecodedCursor): Prisma.ChatMessageWhereInput {
  const createdAt = new Date(cursor.createdAt);
  return {
    OR: [{ createdAt: { lt: createdAt } }, { AND: [{ createdAt }, { id: { lt: cursor.id } }] }],
  };
}
