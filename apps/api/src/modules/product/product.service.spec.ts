import { Test } from "@nestjs/testing";
import { ProductStatus } from "@prisma/client";
import { ProductService } from "./product.service";
import { PrismaService } from "../../infra/prisma/prisma.service";
import { UserService } from "../user/user.service";

describe("ProductService", () => {
  let service: ProductService;
  let prisma: { product: { findMany: jest.Mock } };

  beforeEach(async () => {
    prisma = { product: { findMany: jest.fn() } };

    const module = await Test.createTestingModule({
      providers: [
        ProductService,
        { provide: PrismaService, useValue: prisma },
        { provide: UserService, useValue: {} },
      ],
    }).compile();

    service = module.get(ProductService);
  });

  describe("listMine", () => {
    it("includes non-ACTIVE (blocked/sold) listings, unlike the public list", async () => {
      prisma.product.findMany.mockResolvedValue([
        {
          id: "p1",
          name: "blocked item",
          price: 1000,
          status: ProductStatus.BLOCKED,
          createdAt: new Date(),
          images: [],
        },
      ]);

      const result = await service.listMine("seller-1");

      expect(prisma.product.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { sellerId: "seller-1", deletedAt: null } }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ id: "p1", status: ProductStatus.BLOCKED });
    });
  });
});
