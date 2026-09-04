-- Supabase PostgreSQL Schema for Group Order MVP
-- Run this in Supabase Dashboard > SQL Editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "name" TEXT NOT NULL,
    "email" TEXT,
    "walletBalanceCents" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on email
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_email_idx" ON "User"("email");

-- Group Orders table
CREATE TABLE IF NOT EXISTS "GroupOrder" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "shareCode" TEXT NOT NULL,
    "hostUserId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "paymentMode" TEXT NOT NULL DEFAULT 'HOST_PAYS_ALL',
    "totalAmountCents" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "GroupOrder_pkey" PRIMARY KEY ("id")
);

-- Unique constraint on shareCode
CREATE UNIQUE INDEX IF NOT EXISTS "GroupOrder_shareCode_key" ON "GroupOrder"("shareCode");
CREATE INDEX IF NOT EXISTS "GroupOrder_shareCode_idx" ON "GroupOrder"("shareCode");
CREATE INDEX IF NOT EXISTS "GroupOrder_hostUserId_idx" ON "GroupOrder"("hostUserId");
CREATE INDEX IF NOT EXISTS "GroupOrder_status_idx" ON "GroupOrder"("status");

-- Group Order Items table
CREATE TABLE IF NOT EXISTS "GroupOrderItem" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "groupOrderId" TEXT NOT NULL,
    "userId" TEXT,
    "guestName" TEXT,
    "itemId" TEXT NOT NULL,
    "itemName" TEXT NOT NULL,
    "priceCents" BIGINT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "GroupOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GroupOrderItem_groupOrderId_idx" ON "GroupOrderItem"("groupOrderId");
CREATE INDEX IF NOT EXISTS "GroupOrderItem_userId_idx" ON "GroupOrderItem"("userId");

-- Wallet Transactions table
CREATE TABLE IF NOT EXISTS "WalletTransaction" (
    "id" TEXT NOT NULL DEFAULT uuid_generate_v4(),
    "senderId" TEXT NOT NULL,
    "receiverId" TEXT NOT NULL,
    "amountCents" BIGINT NOT NULL,
    "type" TEXT NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "WalletTransaction_senderId_idx" ON "WalletTransaction"("senderId");
CREATE INDEX IF NOT EXISTS "WalletTransaction_receiverId_idx" ON "WalletTransaction"("receiverId");
CREATE INDEX IF NOT EXISTS "WalletTransaction_referenceId_idx" ON "WalletTransaction"("referenceId");
CREATE INDEX IF NOT EXISTS "WalletTransaction_type_idx" ON "WalletTransaction"("type");

-- Foreign Key Constraints
ALTER TABLE "GroupOrder" ADD CONSTRAINT "GroupOrder_hostUserId_fkey" 
    FOREIGN KEY ("hostUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GroupOrderItem" ADD CONSTRAINT "GroupOrderItem_groupOrderId_fkey" 
    FOREIGN KEY ("groupOrderId") REFERENCES "GroupOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GroupOrderItem" ADD CONSTRAINT "GroupOrderItem_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_senderId_fkey" 
    FOREIGN KEY ("senderId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_receiverId_fkey" 
    FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Seed Data: Demo Users
INSERT INTO "User" ("id", "name", "email", "walletBalanceCents", "createdAt", "updatedAt") VALUES
('user-feras-001', 'Feras', 'feras@example.com', 50000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user-ahmed-002', 'Ahmed', 'ahmed@example.com', 30000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user-sarah-003', 'Sarah', 'sarah@example.com', 20000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

-- Seed Data: Demo Group Order
INSERT INTO "GroupOrder" ("id", "shareCode", "hostUserId", "status", "paymentMode", "totalAmountCents", "createdAt", "updatedAt") VALUES
('order-demo-001', 'DEMO123456', 'user-feras-001', 'OPEN', 'HOST_PAYS_ALL', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;