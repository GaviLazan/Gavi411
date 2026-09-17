-- G411-102: add requestId to Notification for tracking which request a notification is about
-- Column may already exist from db push, so only add if missing
DO $$ BEGIN
  ALTER TABLE "Notification" ADD COLUMN "requestId" INTEGER;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- Ensure the foreign key constraint exists
DO $$ BEGIN
  ALTER TABLE "Notification" ADD CONSTRAINT "Notification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "Request"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
