import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// Bootstraps the first admin: `pnpm --filter @secondhand/api promote-admin <username>`.
// There's no in-app "make admin" action by design — granting admin rights
// is an out-of-band operational step, not something reachable over HTTP.
async function main() {
  const username = process.argv[2];
  if (!username) {
    console.error("Usage: promote-admin <username>");
    process.exit(1);
  }

  const user = await prisma.user.update({
    where: { username },
    data: { role: "ADMIN" },
  });
  console.log(`${user.username} is now an ADMIN.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
