import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { removeItemFromGroupOrder } from '@/lib/group-order';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ shareCode: string; id: string }> }
) {
  try {
    const { shareCode, id } = await params;
    const success = await removeItemFromGroupOrder(shareCode, id);

    if (!success) {
      return NextResponse.json(
        { success: false, message: 'Item not found or cart is locked' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Item removed successfully',
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'CART_LOCKED') {
      return NextResponse.json(
        { success: false, message: 'Cart is locked for checkout' },
        { status: 409 }
      );
    }
    console.error('Remove item error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to remove item' },
      { status: 500 }
    );
  }
}