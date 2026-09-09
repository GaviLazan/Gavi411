-- G411-93: add nudgeTwoSentAt to replace fragile text-matching detection
ALTER TABLE "Request" ADD COLUMN "nudgeTwoSentAt" TIMESTAMP(3);
