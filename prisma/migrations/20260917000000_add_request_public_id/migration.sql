-- AddColumn
ALTER TABLE "Request" ADD COLUMN "publicId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Request_publicId_key" ON "Request"("publicId");
