import { BadRequestException } from "@nestjs/common";
import { buildOrderBy, buildSeekWhere, decodeCursor, encodeCursor } from "./product.pagination";

describe("product cursor pagination (keyset)", () => {
  describe("encodeCursor / decodeCursor", () => {
    it("round-trips a createdAt cursor", () => {
      const item = { id: "abc-123", createdAt: new Date("2026-01-01T00:00:00.000Z"), price: 1000 };
      const cursor = encodeCursor(item, "createdAt");
      const decoded = decodeCursor(cursor);

      expect(decoded).toEqual({ value: "2026-01-01T00:00:00.000Z", id: "abc-123" });
    });

    it("round-trips a price cursor", () => {
      const item = { id: "abc-123", createdAt: new Date(), price: 42000 };
      const cursor = encodeCursor(item, "price");
      const decoded = decodeCursor(cursor);

      expect(decoded).toEqual({ value: "42000", id: "abc-123" });
    });

    it("rejects a malformed cursor instead of throwing an opaque error", () => {
      expect(() => decodeCursor("not-valid-base64url-json")).toThrow(BadRequestException);
    });

    it("rejects a cursor missing the required fields", () => {
      const bogus = Buffer.from(JSON.stringify({ value: 123 })).toString("base64url"); // no `id`
      expect(() => decodeCursor(bogus)).toThrow(BadRequestException);
    });
  });

  describe("buildOrderBy", () => {
    it("always adds id as a tiebreaker in the same direction", () => {
      expect(buildOrderBy("price", "asc")).toEqual([{ price: "asc" }, { id: "asc" }]);
      expect(buildOrderBy("createdAt", "desc")).toEqual([{ createdAt: "desc" }, { id: "desc" }]);
    });
  });

  describe("buildSeekWhere", () => {
    it("builds a numeric seek condition for price with the correct comparison operator", () => {
      const where = buildSeekWhere("price", "desc", { value: "10000", id: "row-1" });

      expect(where).toEqual({
        OR: [{ price: { lt: 10000 } }, { AND: [{ price: 10000 }, { id: { lt: "row-1" } }] }],
      });
    });

    it("flips the comparison operator for ascending order", () => {
      const where = buildSeekWhere("price", "asc", { value: "10000", id: "row-1" });

      expect(where).toEqual({
        OR: [{ price: { gt: 10000 } }, { AND: [{ price: 10000 }, { id: { gt: "row-1" } }] }],
      });
    });

    it("converts the cursor value to a real Date for createdAt sorting", () => {
      const where = buildSeekWhere("createdAt", "desc", { value: "2026-01-01T00:00:00.000Z", id: "row-1" }) as any;

      const seekDate = where.OR[0].createdAt.lt;
      expect(seekDate).toBeInstanceOf(Date);
      expect(seekDate.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });
  });
});
