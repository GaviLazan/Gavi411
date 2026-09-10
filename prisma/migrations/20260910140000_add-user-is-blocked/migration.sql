-- G411-99: add isBlocked flag for admin user blocking
ALTER TABLE "User" ADD COLUMN "isBlocked" BOOLEAN NOT NULL DEFAULT false;
