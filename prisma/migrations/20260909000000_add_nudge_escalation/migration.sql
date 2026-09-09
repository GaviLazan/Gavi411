-- G411-93: add nudge-driven escalation system
-- Message.isSystem flags automated nudges (not real admin replies)
-- Request.nudgedAt tracks the most recent manual nudge timestamp
ALTER TABLE "Message" ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Request" ADD COLUMN "nudgedAt" TIMESTAMP(3);
