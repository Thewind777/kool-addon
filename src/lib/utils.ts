import { SignJWT, jwtVerify } from 'jose';

const QR_JWT_SECRET = new TextEncoder().encode(
  process.env.QR_JWT_SECRET || 'dev-secret-key-change-in-production-min-32-characters-long'
);

export interface QRPayload {
  userId: string;
  userName: string;
  requestedAmountCents?: number; // Optional amount in cents
  type: 'wallet_transfer';
  iat: number;
  exp: number;
}

export interface QRGenerateInput {
  userId: string;
  userName: string;
  requestedAmountCents?: number;
  expirySeconds?: number; // Default 60 seconds
}

/**
 * Generate a signed JWT for QR code payload
 * Includes expiration to prevent replay attacks
 */
export async function generateQRToken(input: QRGenerateInput): Promise<string> {
  const { userId, userName, requestedAmountCents, expirySeconds = 60 } = input;
  
  const token = await new SignJWT({
    userId,
    userName,
    requestedAmountCents,
    type: 'wallet_transfer',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${expirySeconds}s`)
    .sign(QR_JWT_SECRET);

  return token;
}

/**
 * Verify and decode a QR code JWT token
 * Throws if invalid, expired, or tampered
 */
export async function verifyQRToken(token: string): Promise<QRPayload> {
  try {
    const { payload } = await jwtVerify(token, QR_JWT_SECRET);
    
    // Additional validation
    if (payload.type !== 'wallet_transfer') {
      throw new Error('Invalid token type');
    }
    
    return payload as unknown as QRPayload;
  } catch (error) {
    if (error instanceof Error) {
      if (error.message.includes('expired')) {
        throw new Error('QR_CODE_EXPIRED');
      }
      if (error.message.includes('signature')) {
        throw new Error('QR_CODE_INVALID_SIGNATURE');
      }
    }
    throw new Error('QR_CODE_INVALID');
  }
}

/**
 * Format cents as display string (e.g., 1500 -> "$15.00")
 */
export function formatCents(cents: number | bigint): string {
  const value = Number(cents) / 100;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(value);
}

/**
 * Parse display string to cents (e.g., "$15.00" -> 1500)
 */
export function parseCents(value: string): number {
  const num = parseFloat(value.replace(/[^\d.-]/g, ''));
  return Math.round(num * 100);
}

/**
 * Generate a random share code for group orders
 */
export function generateShareCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars
  let result = '';
  for (let i = 0; i < 12; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}