-- G411-46: add creditsResetAt timestamp for monthly credit reset job
ALTER TABLE "User" ADD COLUMN "creditsResetAt" TIMESTAMP(3);
