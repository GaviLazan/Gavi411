-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "encrypted" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "publicKey" TEXT;
