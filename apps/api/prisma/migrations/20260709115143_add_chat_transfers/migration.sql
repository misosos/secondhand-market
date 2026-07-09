-- CreateEnum
CREATE TYPE "ChatMessageType" AS ENUM ('TEXT', 'TRANSFER');

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT "Transaction_productId_fkey";

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "amount" INTEGER,
ADD COLUMN     "type" "ChatMessageType" NOT NULL DEFAULT 'TEXT';

-- AlterTable
ALTER TABLE "Transaction" ALTER COLUMN "productId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;
