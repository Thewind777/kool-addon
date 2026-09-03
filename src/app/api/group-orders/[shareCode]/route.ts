import { NextRequest, NextResponse } from 'next/server';
import { getGroupOrderByShareCode, getParticipantBreakdown } from '@/lib/group-order';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareCode: string }> }
) {
  try {
    const { shareCode } = await params;
    const groupOrder = await getGroupOrderByShareCode(shareCode);

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
  } catch (error) {
    console.error('Get group order error:', error);
    return NextResponse.json(
      { success: false, message: 'Failed to get group order' },
      { status: 500 }
    );
  }
}