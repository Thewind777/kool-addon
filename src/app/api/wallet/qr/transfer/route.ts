import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { verifyQRToken } from '@/lib/utils';
import { executeWalletTransfer } from '@/lib/wallet';
import { z } from 'zod';

const transferSchema = z.object({
  senderId: z.string().min(1),
  token: z.string().min(1),
  pin: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { senderId, token, pin } = transferSchema.parse(body);

    // Verify and decode QR token
    let payload;
    try {
      payload = await verifyQRToken(token);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid QR code';
      return NextResponse.json(
        { success: false, message },
        { status: 400 }
      );
    }

    const { userId: receiverId, userName: receiverName, requestedAmountCents } = payload;

    // Prevent self-transfer
    if (senderId === receiverId) {
      return NextResponse.json(
        { success: false, message: 'Cannot transfer to yourself' },
        { status: 400 }
      );
    }

    // Determine amount: use requested amount or ask for confirmation
    const amountCents = requestedAmountCents || 0;

    if (amountCents <= 0) {
      return NextResponse.json(
        { success: false, message: 'Invalid amount. Please specify amount in QR code.' },
        { status: 400 }
      );
    }

    // Execute atomic transfer
    const result = await executeWalletTransfer(
      senderId,
      receiverId,
      amountCents,
      'P2P_QR_TRANSFER',
      `qr-${Date.now()}`
    );

    return NextResponse.json(result, { 
      status: result.success ? 200 : 400 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: 'Invalid input', errors: error.errors },
        { status: 400 }
      );
    }
    console.error('QR transfer error:', error);
    return NextResponse.json(
      { success: false, message: 'Transfer failed' },
      { status: 500 }
    );
  }
}