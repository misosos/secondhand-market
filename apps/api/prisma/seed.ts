import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // Global chat room is disabled by default per spec (1:1 DM only for MVP),
  // but the row is seeded so the schema/feature can be toggled on later
  // without a migration.
  const existingGlobalRoom = await prisma.chatRoom.findFirst({
    where: { isGlobal: true },
  });

  if (!existingGlobalRoom) {
    await prisma.chatRoom.create({
      data: { isGlobal: true },
    });
    console.log("Seeded global chat room.");
  } else {
    console.log("Global chat room already exists, skipping.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
