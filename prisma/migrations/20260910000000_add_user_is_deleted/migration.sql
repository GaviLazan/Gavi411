-- G411-96: add isDeleted soft-delete flag for account deletion
ALTER TABLE "User" ADD COLUMN "isDeleted" BOOLEAN NOT NULL DEFAULT false;
