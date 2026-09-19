-- G411-107: add soft-clear for notification history
ALTER TABLE "Notification" ADD COLUMN "clearedAt" TIMESTAMP;
