-- G411-47: admin-approved credit overdraft
-- Add OVERDRAFT_PENDING and OVERDRAFT_DENIED to Status enum
ALTER TYPE "Status" ADD VALUE 'OVERDRAFT_PENDING' BEFORE 'CANCELLED';
ALTER TYPE "Status" ADD VALUE 'OVERDRAFT_DENIED' AFTER 'OVERDRAFT_PENDING';

-- Add overdraftUsedAt to User table
ALTER TABLE "User" ADD COLUMN "overdraftUsedAt" TIMESTAMP;

-- Add isOverdraft to Request table
ALTER TABLE "Request" ADD COLUMN "isOverdraft" BOOLEAN NOT NULL DEFAULT false;
