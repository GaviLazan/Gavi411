-- G411-90: tracks whether this request's most recent exit was refunded,
-- so a reopen knows whether to charge a credit back.
ALTER TABLE "Request" ADD COLUMN "refundedAt" TIMESTAMP(3);
