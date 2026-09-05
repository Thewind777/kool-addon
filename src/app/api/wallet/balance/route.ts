import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/prisma';
import { z } from 'zod';

const balanceQuerySchema = z.object({
  userId: z.string().min(1),
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');

    const result = balanceQuerySchema.safeParse({ userId });

    if (!result.success) {
      return NextResponse.json(
        { success: false, message: 'Invalid user ID' },
        { status: 400 }
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: result.data.userId },
      select: { walletBalanceCents: true },
    });

    if (!user) {
      return NextResponse.json(
        { success: false, message: 'User not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { balance: Number(user.walletBalanceCents) },
    });
  } catch (error) {
    console.error('Get balance error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to get balance' },
      { status: 500 }
    );
  }
}