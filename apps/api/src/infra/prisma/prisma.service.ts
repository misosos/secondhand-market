import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

// Soft-delete filtering (`deletedAt: null`) is applied explicitly in each
// module's service query, not via a global Prisma extension here — that
// keeps admin/audit paths free to query deleted rows without an escape
// hatch, at the cost of remembering the filter per query.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
