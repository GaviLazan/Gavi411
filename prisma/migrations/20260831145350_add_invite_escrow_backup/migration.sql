-- AlterTable
ALTER TABLE "PendingInvite" ADD COLUMN     "backupCiphertext" TEXT,
ADD COLUMN     "backupIv" TEXT,
ADD COLUMN     "backupSalt" TEXT;
