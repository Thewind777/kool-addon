import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Create demo users
  const feras = await prisma.user.upsert({
    where: { email: 'feras@example.com' },
    update: {},
    create: {
      name: 'Feras',
      email: 'feras@example.com',
      walletBalanceCents: 50000, // $500.00
    },
  });

  const ahmed = await prisma.user.upsert({
    where: { email: 'ahmed@example.com' },
    update: {},
    create: {
      name: 'Ahmed',
      email: 'ahmed@example.com',
      walletBalanceCents: 30000, // $300.00
    },
  });

  const sarah = await prisma.user.upsert({
    where: { email: 'sarah@example.com' },
    update: {},
    create: {
      name: 'Sarah',
      email: 'sarah@example.com',
      walletBalanceCents: 20000, // $200.00
    },
  });

  console.log('✅ Created users:', { feras: feras.id, ahmed: ahmed.id, sarah: sarah.id });

  // Create a sample group order
  const groupOrder = await prisma.groupOrder.create({
    data: {
      shareCode: 'DEMO123456',
      hostUserId: feras.id,
      status: 'OPEN',
      paymentMode: 'SPLIT_WALLETS',
      totalAmountCents: 0,
      items: {
        create: [
          {
            userId: feras.id,
            itemId: 'ITEM-001',
            itemName: 'Chicken Burger',
            priceCents: 1500,
            quantity: 2,
          },
          {
            userId: ahmed.id,
            itemId: 'ITEM-002',
            itemName: 'Caesar Salad',
            priceCents: 1200,
            quantity: 1,
          },
        ],
      },
    },
    include: { items: true },
  });

  // Update total amount
  const total = groupOrder.items.reduce((sum, item) => sum + Number(item.priceCents) * item.quantity, 0);
  await prisma.groupOrder.update({
    where: { id: groupOrder.id },
    data: { totalAmountCents: BigInt(total) },
  });

  console.log('✅ Created group order:', groupOrder.shareCode);

  // Create a sample wallet transaction
  await prisma.walletTransaction.create({
    data: {
      senderId: feras.id,
      receiverId: ahmed.id,
      amountCents: 5000,
      type: 'P2P_QR_TRANSFER',
      referenceId: 'qr-session-123',
    },
  });

  console.log('✅ Created sample wallet transaction');
  console.log('🎉 Seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });