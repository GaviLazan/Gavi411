-- CreateTable
CREATE TABLE "PendingInvite" (
    "token" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "usedAt" TIMESTAMP(3),
    "usedByUserId" TEXT,

    CONSTRAINT "PendingInvite_pkey" PRIMARY KEY ("token")
);

-- CreateIndex
CREATE UNIQUE INDEX "PendingInvite_usedByUserId_key" ON "PendingInvite"("usedByUserId");

-- AddForeignKey
ALTER TABLE "PendingInvite" ADD CONSTRAINT "PendingInvite_usedByUserId_fkey" FOREIGN KEY ("usedByUserId") REFERENCES "User"("clerkId") ON DELETE SET NULL ON UPDATE CASCADE;
