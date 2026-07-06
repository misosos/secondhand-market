// Mirrors apps/api/prisma/schema.prisma enums exactly. Keep in sync manually
// since Prisma's generated enums are not importable from the web app.

export enum AccountStatus {
  ACTIVE = "ACTIVE",
  DORMANT = "DORMANT",
}

export enum ProductStatus {
  ACTIVE = "ACTIVE",
  BLOCKED = "BLOCKED",
  SOLD = "SOLD",
}

export enum ReportTargetType {
  USER = "USER",
  PRODUCT = "PRODUCT",
}

export enum ReportStatus {
  PENDING = "PENDING",
  RESOLVED = "RESOLVED",
  REJECTED = "REJECTED",
}
