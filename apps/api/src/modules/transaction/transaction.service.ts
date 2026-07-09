import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AccountStatus, Prisma, ProductStatus, Transaction } from "@prisma/client";
import type { CursorPaginationResult, TransactionDto } from "@secondhand/types";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { UserService } from "../user/user.service";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./transaction.constants";
import { buildSeekWhere, decodeCursor, encodeCursor } from "./transaction.pagination";

type TransactionWithParties = Transaction & {
  buyer: { id: string; username: string };
  seller: { id: string; username: string };
  product: { name: string };
};

@Injectable()
export class TransactionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  // The only way balance ever moves between users. Two invariants matter
  // here and both are enforced with a conditional updateMany (not a plain
  // findFirst-then-update), because a naive read-then-write would let two
  // concurrent purchases both pass their checks before either commits:
  //   1. A product can only be sold once (updateMany guards on status
  //      still being ACTIVE at write time, not just at read time).
  //   2. A buyer can never go negative (updateMany guards on balance still
  //      being >= price at write time, not the possibly-stale value read
  //      earlier in this same function).
  // If either guard's affected-row count is 0, we throw and Prisma's
  // $transaction rolls back everything already done in this call —
  // including the product's ACTIVE->SOLD flip from step 1 if step 2 fails.
  async purchase(buyerId: string, productId: string): Promise<TransactionDto> {
    const buyer = await this.userService.findActiveById(buyerId);
    if (!buyer) throw new NotFoundException("Buyer not found");
    if (buyer.status === AccountStatus.DORMANT) {
      throw new ForbiddenException("Dormant accounts cannot make purchases");
    }

    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null },
      include: { seller: true },
    });
    if (!product) throw new NotFoundException("Product not found");
    if (product.sellerId === buyerId) throw new BadRequestException("Cannot purchase your own product");
    if (product.status !== ProductStatus.ACTIVE) {
      throw new ConflictException("Product is not available for purchase");
    }
    if (buyer.balance < product.price) throw new BadRequestException("Insufficient balance");

    const transaction = await this.prisma.$transaction(async (tx) => {
      const productUpdate = await tx.product.updateMany({
        where: { id: productId, status: ProductStatus.ACTIVE },
        data: { status: ProductStatus.SOLD },
      });
      if (productUpdate.count === 0) {
        throw new ConflictException("Product was already sold");
      }

      const buyerUpdate = await tx.user.updateMany({
        where: { id: buyerId, balance: { gte: product.price } },
        data: { balance: { decrement: product.price } },
      });
      if (buyerUpdate.count === 0) {
        throw new BadRequestException("Insufficient balance");
      }

      await tx.user.update({
        where: { id: product.sellerId },
        data: { balance: { increment: product.price } },
      });

      return tx.transaction.create({
        data: { buyerId, sellerId: product.sellerId, productId, amount: product.price },
        include: { buyer: true, seller: true, product: true },
      });
    });

    return this.toDto(transaction);
  }

  listMine(userId: string, cursor?: string, limit?: number): Promise<CursorPaginationResult<TransactionDto>> {
    return this.list({ OR: [{ buyerId: userId }, { sellerId: userId }] }, cursor, limit);
  }

  // Unscoped — for admin oversight of every transaction on the platform.
  // Access control lives at the controller (AdminGuard), not here.
  listAll(cursor?: string, limit?: number): Promise<CursorPaginationResult<TransactionDto>> {
    return this.list({}, cursor, limit);
  }

  private async list(
    baseWhere: Prisma.TransactionWhereInput,
    cursor?: string,
    limit?: number,
  ): Promise<CursorPaginationResult<TransactionDto>> {
    const take = Math.min(limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);

    // Both `OR` (membership filter) and `AND` (cursor seek) can live as
    // sibling top-level keys on the same Prisma where-input — they're
    // implicitly ANDed together — so spreading a cursor's AND onto a
    // caller-supplied OR never overwrites it (see ProductService.list for
    // the same pattern with keyword search + cursor).
    const where: Prisma.TransactionWhereInput = { ...baseWhere };
    if (cursor) {
      where.AND = [buildSeekWhere(decodeCursor(cursor))];
    }

    const rows = await this.prisma.transaction.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      include: { buyer: true, seller: true, product: true },
    });

    const hasNext = rows.length > take;
    const items = hasNext ? rows.slice(0, take) : rows;

    return {
      items: items.map((row) => this.toDto(row)),
      nextCursor: hasNext ? encodeCursor(items[items.length - 1]) : null,
    };
  }

  private toDto(transaction: TransactionWithParties): TransactionDto {
    return {
      id: transaction.id,
      productId: transaction.productId,
      productName: transaction.product.name,
      buyer: { id: transaction.buyer.id, username: transaction.buyer.username },
      seller: { id: transaction.seller.id, username: transaction.seller.username },
      amount: transaction.amount,
      createdAt: transaction.createdAt.toISOString(),
    };
  }
}
