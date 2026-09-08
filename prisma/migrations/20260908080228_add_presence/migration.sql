-- CreateTable
CREATE TABLE "Presence" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "isOnline" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Presence_pkey" PRIMARY KEY ("id")
);
