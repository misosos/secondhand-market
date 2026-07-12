import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AccountStatus, Prisma, ProductStatus, Transaction, TransactionStatus } from "@prisma/client";
import type { CursorPaginationResult, TransactionDto } from "@secondhand/types";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { UserService } from "../user/user.service";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./transaction.constants";
import { buildSeekWhere, decodeCursor, encodeCursor } from "./transaction.pagination";

type TransactionWithParties = Transaction & {
  buyer: { id: string; username: string };
  seller: { id: string; username: string };
  product: { name: string } | null;
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

  // Danggeun-Pay-style direct transfer, escrow style (받기 must be tapped
  // before the money actually reaches the recipient): this only debits the
  // sender and parks the amount in a PENDING transaction — see
  // acceptTransfer/rejectTransfer for where it actually lands or bounces
  // back. Same balance-safety invariant as purchase() (conditional
  // updateMany so a concurrent transfer/purchase can never push the sender
  // negative), just without a product to flip. Room/membership validation
  // (so this can only be called between two people who share a DM) lives in
  // ChatService.sendTransfer, which is the only caller — this method only
  // knows about the two user ids.
  async initiateTransfer(senderId: string, recipientId: string, amount: number): Promise<TransactionDto> {
    if (senderId === recipientId) throw new BadRequestException("Cannot send money to yourself");
    if (!Number.isInteger(amount) || amount <= 0) throw new BadRequestException("Invalid amount");

    const sender = await this.userService.findActiveById(senderId);
    if (!sender) throw new NotFoundException("Sender not found");
    if (sender.status === AccountStatus.DORMANT) {
      throw new ForbiddenException("Dormant accounts cannot send money");
    }
    const recipient = await this.userService.findActiveById(recipientId);
    if (!recipient) throw new NotFoundException("Recipient not found");
    if (recipient.status === AccountStatus.DORMANT) {
      throw new ForbiddenException("Cannot send money to a dormant account");
    }
    if (sender.balance < amount) throw new BadRequestException("Insufficient balance");

    const transaction = await this.prisma.$transaction(async (tx) => {
      const senderUpdate = await tx.user.updateMany({
        where: { id: senderId, balance: { gte: amount } },
        data: { balance: { decrement: amount } },
      });
      if (senderUpdate.count === 0) {
        throw new BadRequestException("Insufficient balance");
      }

      return tx.transaction.create({
        data: { buyerId: senderId, sellerId: recipientId, productId: null, amount, status: TransactionStatus.PENDING },
        include: { buyer: true, seller: true, product: true },
      });
    });

    return this.toDto(transaction);
  }

  // 받기: only the recipient (transaction.sellerId) can accept, and only
  // once — the guarded updateMany means a simultaneous accept+reject race
  // (or a double-tapped accept button) can only ever have one winner, the
  // loser's affected-row count comes back 0 and throws instead of double
  // crediting the recipient.
  async acceptTransfer(transactionId: string, userId: string): Promise<TransactionDto> {
    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new NotFoundException("Transfer not found");
    if (transaction.sellerId !== userId) {
      throw new ForbiddenException("Only the recipient can accept this transfer");
    }
    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException("Transfer has already been settled");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const statusUpdate = await tx.transaction.updateMany({
        where: { id: transactionId, status: TransactionStatus.PENDING },
        data: { status: TransactionStatus.COMPLETED },
      });
      if (statusUpdate.count === 0) {
        throw new BadRequestException("Transfer has already been settled");
      }

      await tx.user.update({
        where: { id: userId },
        data: { balance: { increment: transaction.amount } },
      });

      return tx.transaction.findUniqueOrThrow({
        where: { id: transactionId },
        include: { buyer: true, seller: true, product: true },
      });
    });

    return this.toDto(updated);
  }

  // 거절: hands the held amount straight back to the sender (buyerId) —
  // same double-settlement guard as acceptTransfer.
  async rejectTransfer(transactionId: string, userId: string): Promise<TransactionDto> {
    const transaction = await this.prisma.transaction.findUnique({ where: { id: transactionId } });
    if (!transaction) throw new NotFoundException("Transfer not found");
    if (transaction.sellerId !== userId) {
      throw new ForbiddenException("Only the recipient can reject this transfer");
    }
    if (transaction.status !== TransactionStatus.PENDING) {
      throw new BadRequestException("Transfer has already been settled");
    }

    const updated = await this.prisma.$transaction(async (tx) => {
      const statusUpdate = await tx.transaction.updateMany({
        where: { id: transactionId, status: TransactionStatus.PENDING },
        data: { status: TransactionStatus.REJECTED },
      });
      if (statusUpdate.count === 0) {
        throw new BadRequestException("Transfer has already been settled");
      }

      await tx.user.update({
        where: { id: transaction.buyerId },
        data: { balance: { increment: transaction.amount } },
      });

      return tx.transaction.findUniqueOrThrow({
        where: { id: transactionId },
        include: { buyer: true, seller: true, product: true },
      });
    });

    return this.toDto(updated);
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
      productName: transaction.product?.name ?? null,
      buyer: { id: transaction.buyer.id, username: transaction.buyer.username },
      seller: { id: transaction.seller.id, username: transaction.seller.username },
      amount: transaction.amount,
      status: transaction.status,
      createdAt: transaction.createdAt.toISOString(),
    };
  }
}
