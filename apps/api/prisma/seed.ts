import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";
import { BCRYPT_SALT_ROUNDS } from "../src/modules/auth/auth.constants";

const prisma = new PrismaClient();

const DEMO_SELLER_USERNAME = "demo_seller";
const DEMO_SELLER_PASSWORD = "password123";

// Real, verified-live Unsplash photos (Unsplash License — free for
// commercial use, no attribution required), resized to a 600x600 crop to
// match the app's 1:1 product-thumbnail aspect ratio. See
// https://images.unsplash.com/photo-<id> for the source.
const DEMO_PRODUCTS = [
  {
    name: "아이폰 13 미니 128GB",
    price: 420_000,
    description: "배터리 성능 89%, 액정 잔기스 약간 있습니다. 박스/케이블 포함.",
    photoId: "1727013884184-b313982327f3",
  },
  {
    name: "원목 책상 1200폭",
    price: 65_000,
    description: "이사로 인해 판매합니다. 서랍 2단, 상태 양호합니다.",
    photoId: "1684069158042-de27cd720172",
  },
  {
    name: "컨버스 화이트",
    price: 45_000,
    description: "250mm, 3회 착용 거의 새 제품입니다.",
    photoId: "1676379827610-c380c52db0c6",
  },
  {
    name: "캠핑 랜턴 (충전식)",
    price: 18_000,
    description: "캠핑 2번 사용, 정상 작동합니다. 케이블 포함.",
    photoId: "1503469519549-4415016d57a3",
  },
  {
    name: "무선 이어폰 (노이즈캔슬링)",
    price: 52_000,
    description: "케이스 포함, 사용감 적습니다.",
    photoId: "1505740420928-5e560c06d30e",
  },
  {
    name: "미니벨로 접이식 자전거",
    price: 95_000,
    description: "타이어 최근 교체, 직거래만 가능합니다.",
    photoId: "1579089286082-15c8b518ecc6",
  },
] as const;

function unsplashUrl(photoId: string): string {
  return `https://images.unsplash.com/photo-${photoId}?w=600&h=600&fit=crop&auto=format&q=80`;
}

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

  // Demo listings so a fresh clone doesn't start on an empty home page.
  // Local-dev/demo account only — not created in any deployed environment.
  const existingDemoSeller = await prisma.user.findUnique({
    where: { username: DEMO_SELLER_USERNAME },
  });

  if (!existingDemoSeller) {
    const passwordHash = await bcrypt.hash(DEMO_SELLER_PASSWORD, BCRYPT_SALT_ROUNDS);
    const demoSeller = await prisma.user.create({
      data: { username: DEMO_SELLER_USERNAME, password: passwordHash, balance: 100_000 },
    });
    for (const product of DEMO_PRODUCTS) {
      await prisma.product.create({
        data: {
          sellerId: demoSeller.id,
          name: product.name,
          description: product.description,
          price: product.price,
          images: { create: [{ url: unsplashUrl(product.photoId), sortOrder: 0 }] },
        },
      });
    }
    console.log(`Seeded demo seller "${DEMO_SELLER_USERNAME}" with ${DEMO_PRODUCTS.length} products.`);
  } else {
    console.log("Demo seller already exists, skipping.");
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
