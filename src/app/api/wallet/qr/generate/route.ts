import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { generateQRToken } from '@/lib/utils';
import { getWalletBalance } from '@/lib/wallet';
import { z } from 'zod';

const generateQRSchema = z.object({
  userId: z.string().uuid(),
  userName: z.string().min(1).max(100),
  requestedAmountCents: z.number().int().positive().optional(),
  expirySeconds: z.number().int().positive().max(300).default(60),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { userId, userName, requestedAmountCents, expirySeconds } = generateQRSchema.parse(body);

    // Verify user exists and get balance
    const balance = await getWalletBalance(userId);
    if (balance === 0 && !requestedAmountCents) {
      return NextResponse.json(
        { success: false, message: 'User has no wallet balance' },
        { status: 400 }
      );
    }

    // Generate signed JWT token
    const token = await generateQRToken({
      userId,
      userName,
      requestedAmountCents,
      expirySeconds,
    });

    // Generate QR code data URL
    const QRCode = await import('qrcode');
    const qrCodeDataUrl = await QRCode.default.toDataURL(token, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        token,
        qrCodeDataUrl,
        expiresIn: expirySeconds,
        user: { id: userId, name: userName },
        requestedAmountCents,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, message: 'Invalid input', errors: error.errors },
        { status: 400 }
      );
    }
    console.error('Generate QR error:', error);
    const msg = error instanceof Error ? error.message : 'Failed to generate QR code';
    return NextResponse.json(
      { success: false, message: msg },
      { status: 500 }
    );
  }
}