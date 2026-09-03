import { NextRequest, NextResponse } from 'next/server';
import { createGroupOrder } from '@/lib/group-order';
import { z } from 'zod';

const createOrderSchema = z.object({
  hostUserId: z.string().uuid(),
  paymentMode: z.enum(['HOST_PAYS_ALL', 'SPLIT_WALLETS']).default('HOST_PAYS_ALL'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { hostUserId, paymentMode } = createOrderSchema.parse(body);

    const groupOrder = await createGroupOrder(hostUserId, paymentMode);

    return NextResponse.json({
      success: true,
      data: groupOrder,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: 'Invalid input', errors: error.errors },
        { status: 400 }
      );
    }
    console.error('Create group order error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to create group order' },
      { status: 500 }
    );
  }
}