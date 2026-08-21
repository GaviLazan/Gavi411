-- Rename Request.fallbackNotes -> additionalInfo. Reflects the real
-- design: this field is used across every follow-up path (GENERAL and
-- every matched type), not just a fallback-only case. Request table
-- confirmed empty at time of this migration, no data mapping needed.
ALTER TABLE "Request" RENAME COLUMN "fallbackNotes" TO "additionalInfo";
