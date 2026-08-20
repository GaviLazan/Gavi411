-- Rename Urgency enum value MEDIUM -> NORMAL (Gavi's call: reads more
-- naturally to users). Request table has zero rows at time of this
-- migration, confirmed before writing it, so no data mapping needed.
ALTER TYPE "Urgency" RENAME VALUE 'MEDIUM' TO 'NORMAL';
ALTER TABLE "Request" ALTER COLUMN "urgency" SET DEFAULT 'NORMAL';
