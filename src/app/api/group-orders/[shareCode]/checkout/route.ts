import { NextRequest, NextResponse } from 'next/server';
import { lockGroupOrderForCheckout, processGroupOrderPayment, getParticipantBreakdown } from '@/lib/group-order';
import { z } from 'zod';

const checkoutSchema = z.object({
  hostUserId: z.string().uuid(),
  action: z.enum(['lock', 'pay']),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  try {
    const { shareCode } = await params;
    const body = await request.json();
    const { hostUserId, action } = checkoutSchema.parse(body);

    if (action === 'lock') {
      const groupOrder = await lockGroupOrderForCheckout(shareCode);
      
      if (!groupOrder) {
        return NextResponse.json(
          { success: false, message: 'Group order not found' },
          { status: 404 }
        );
      }

      const breakdown = await getParticipantBreakdown(shareCode);

      return NextResponse.json({
        success: true,
        data: {
          ...groupOrder,
          breakdown,
        },
      });
    }

    if (action === 'pay') {
      const result = await processGroupOrderPayment(shareCode, hostUserId);
      
      return NextResponse.json(result, { 
        status: result.success ? 200 : 400 
      });
    }

    return NextResponse.json(
      { success: false, message: 'Invalid action' },
      { status: 400 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: 'Invalid input', errors: error.errors },
        { status: 400 }
      );
    }
    if (error instanceof Error && error.message === 'ALREADY_LOCKED') {
      return NextResponse.json(
        { success: false, message: 'Cart is already locked' },
        { status: 409 }
      );
    }
    console.error('Checkout error:', error);
    return NextResponse.json(
      { success: false, message: 'Checkout failed' },
      { status: 500 }
    );
  }
}