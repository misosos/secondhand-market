// Prisma's unique-constraint violation code, shared by any service that
// creates a row behind a @@unique (auth signup, report creation) so they
// all translate it to the same kind of exception instead of a raw 500.
export function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: string }).code === "P2002";
}
