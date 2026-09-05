import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const transactionsQuerySchema = z.object({
  userId: z.string().uuid(),
  limit: z.number().int().positive().max(100).default(20),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const limit = searchParams.get('limit');

    const result = transactionsQuerySchema.safeParse({
      userId,
      limit: limit ? parseInt(limit) : 20,
    });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid parameters' },
        { status: 400 }
      );
    }

    const transactions = await prisma.walletTransaction.findMany({
      where: {
        OR: [{ senderId: result.data.userId }, { receiverId: result.data.userId }],
      },
      include: {
        sender: { select: { id: true, name: true } },
        receiver: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: result.data.limit,
    });

    return NextResponse.json({
      success: true,
      data: transactions.map(tx => ({
        ...tx,
        amountCents: Number(tx.amountCents),
      })),
    });
  } catch (error) {
    console.error('Get transactions error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to get transactions' },
      { status: 500 }
    );
  }
}