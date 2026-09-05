-- Seed Data: Demo Users (Feras=$500, Ahmed=$300, Sarah=$0)
INSERT INTO "User" ("id", "name", "email", "walletBalanceCents", "createdAt", "updatedAt") VALUES
('user-feras-001', 'Feras', 'feras@example.com', 50000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user-ahmed-002', 'Ahmed', 'ahmed@example.com', 30000, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
('user-sarah-003', 'Sarah', 'sarah@example.com', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO UPDATE SET "walletBalanceCents" = EXCLUDED."walletBalanceCents";

-- Seed Data: Demo Group Order
INSERT INTO "GroupOrder" ("id", "shareCode", "hostUserId", "status", "paymentMode", "totalAmountCents", "createdAt", "updatedAt") VALUES
('order-demo-001', 'DEMO123456', 'user-feras-001', 'OPEN', 'HOST_PAYS_ALL', 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;