import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { AccountStatus, Prisma, Product, ProductImage, ProductStatus } from "@prisma/client";
import type {
  CreateProductRequest,
  CursorPaginationResult,
  ProductDetail,
  ProductListQuery,
  ProductStatus as SharedProductStatus,
  ProductSummary,
  UpdateProductRequest,
} from "@secondhand/types";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { UserService } from "../user/user.service";
import { DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } from "./product.constants";
import { buildOrderBy, buildSeekWhere, decodeCursor, encodeCursor } from "./product.pagination";

type ProductWithImages = Product & { images: ProductImage[] };

@Injectable()
export class ProductService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly userService: UserService,
  ) {}

  async create(sellerId: string, dto: CreateProductRequest): Promise<ProductDetail> {
    await this.assertSellerActive(sellerId);

    const product = await this.prisma.product.create({
      data: {
        name: dto.name,
        description: dto.description,
        price: dto.price,
        sellerId,
        images: { create: dto.imageUrls.map((url, index) => ({ url, sortOrder: index })) },
      },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });

    return this.toDetail(product);
  }

  async update(sellerId: string, productId: string, dto: UpdateProductRequest): Promise<ProductDetail> {
    await this.findOwned(sellerId, productId);

    const product = await this.prisma.$transaction(async (tx) => {
      if (dto.imageUrls) {
        await tx.productImage.deleteMany({ where: { productId } });
      }

      return tx.product.update({
        where: { id: productId },
        data: {
          ...(dto.name !== undefined && { name: dto.name }),
          ...(dto.description !== undefined && { description: dto.description }),
          ...(dto.price !== undefined && { price: dto.price }),
          ...(dto.imageUrls !== undefined && {
            images: { create: dto.imageUrls.map((url, index) => ({ url, sortOrder: index })) },
          }),
        },
        include: { images: { orderBy: { sortOrder: "asc" } } },
      });
    });

    return this.toDetail(product);
  }

  async remove(sellerId: string, productId: string): Promise<void> {
    await this.findOwned(sellerId, productId);
    await this.prisma.product.update({ where: { id: productId }, data: { deletedAt: new Date() } });
  }

  async findDetail(productId: string): Promise<ProductDetail> {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, deletedAt: null, status: { not: ProductStatus.BLOCKED } },
      include: { images: { orderBy: { sortOrder: "asc" } } },
    });
    if (!product) throw new NotFoundException("Product not found");
    return this.toDetail(product);
  }

  async list(query: ProductListQuery): Promise<CursorPaginationResult<ProductSummary>> {
    const limit = Math.min(query.limit ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
    const sortBy = query.sortBy ?? "createdAt";
    const order = query.order ?? "desc";

    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      deletedAt: null,
    };

    if (query.keyword) {
      where.OR = [
        { name: { contains: query.keyword, mode: "insensitive" } },
        { description: { contains: query.keyword, mode: "insensitive" } },
      ];
    }

    if (query.cursor) {
      where.AND = [buildSeekWhere(sortBy, order, decodeCursor(query.cursor))];
    }

    const rows = await this.prisma.product.findMany({
      where,
      orderBy: buildOrderBy(sortBy, order),
      take: limit + 1,
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    });

    const hasNext = rows.length > limit;
    const items = hasNext ? rows.slice(0, limit) : rows;

    return {
      items: items.map((p) => this.toSummary(p)),
      nextCursor: hasNext ? encodeCursor(items[items.length - 1], sortBy) : null,
    };
  }

  // Unlike list()/findDetail(), this deliberately includes BLOCKED/SOLD
  // items — a seller managing their own listings needs to see why
  // something disappeared from the public list, not just the live ones.
  async listMine(sellerId: string): Promise<ProductSummary[]> {
    const products = await this.prisma.product.findMany({
      where: { sellerId, deletedAt: null },
      orderBy: { createdAt: "desc" },
      include: { images: { orderBy: { sortOrder: "asc" }, take: 1 } },
    });
    return products.map((p) => this.toSummary(p));
  }

  private async findOwned(sellerId: string, productId: string): Promise<Product> {
    const product = await this.prisma.product.findFirst({ where: { id: productId, deletedAt: null } });
    if (!product) throw new NotFoundException("Product not found");
    if (product.sellerId !== sellerId) throw new ForbiddenException("Not the owner of this product");
    return product;
  }

  private async assertSellerActive(sellerId: string): Promise<void> {
    const seller = await this.userService.findActiveById(sellerId);
    if (!seller) throw new NotFoundException("Seller not found");
    if (seller.status === AccountStatus.DORMANT) {
      throw new ForbiddenException("Dormant accounts cannot register products");
    }
  }

  private toSummary(product: ProductWithImages): ProductSummary {
    return {
      id: product.id,
      name: product.name,
      price: product.price,
      status: product.status as unknown as SharedProductStatus,
      thumbnailUrl: product.images[0]?.url ?? null,
      createdAt: product.createdAt.toISOString(),
    };
  }

  private toDetail(product: ProductWithImages): ProductDetail {
    return {
      ...this.toSummary(product),
      description: product.description,
      sellerId: product.sellerId,
      images: product.images.map((image) => ({
        id: image.id,
        url: image.url,
        sortOrder: image.sortOrder,
      })),
    };
  }
}
