import { NextRequest, NextResponse } from 'next/server';
import { addItemToGroupOrder } from '@/lib/group-order';
import { z } from 'zod';

const addItemSchema = z.object({
  userId: z.string().uuid().optional(),
  guestName: z.string().min(1).max(100).optional(),
  itemId: z.string().min(1).max(100),
  itemName: z.string().min(1).max(255),
  priceCents: z.number().int().positive(),
  quantity: z.number().int().positive().default(1),
}).refine(
  (data) => data.userId || data.guestName,
  { message: 'Either userId or guestName is required', path: ['userId'] }
);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  try {
    const { shareCode } = await params;
    const body = await request.json();
    const itemData = addItemSchema.parse(body);

    const item = await addItemToGroupOrder(shareCode, itemData);

    if (!item) {
      return NextResponse.json(
        { success: false, message: 'Group order not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: item,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: 'Invalid input', errors: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === 'CART_LOCKED') {
      return NextResponse.json(
        { success: false, message: 'Cart is locked for checkout' },
        { status: 409 }
      );
    }
    console.error('Add item error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to add item' },
      { status: 500 }
    );
  }
}