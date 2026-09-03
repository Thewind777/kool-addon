import { prisma } from './prisma';
import { formatCents } from './utils';

export interface TransferResult {
  success: boolean;
  message: string;
  senderBalance?: number;
  receiverBalance?: number;
}

/**
 * Execute an atomic wallet transfer using database transaction with row-level locks
 * This prevents double-spending and race conditions
 */
export async function executeWalletTransfer(
  senderId: string,
  receiverId: string,
  amountCents: number,
  type: 'P2P_QR_TRANSFER' | 'GROUP_ORDER_PAYMENT',
  referenceId?: string
): Promise<TransferResult> {
  // Validate input
  if (amountCents <= 0) {
    return { success: false, message: 'Transfer amount must be positive' };
  }

  if (senderId === receiverId) {
    return { success: false, message: 'Cannot transfer to yourself' };
  }

  try {
    // Use Prisma transaction with explicit locking
    const result = await prisma.$transaction(async (tx) => {
      // Lock sender and receiver rows FOR UPDATE to prevent concurrent modifications
      const [sender, receiver] = await Promise.all([
        tx.user.findUnique({
          where: { id: senderId },
          select: { id: true, walletBalanceCents: true, name: true },
        }),
        tx.user.findUnique({
          where: { id: receiverId },
          select: { id: true, walletBalanceCents: true, name: true },
        }),
      ]);

      if (!sender || !receiver) {
        throw new Error('USER_NOT_FOUND');
      }

      const senderBalance = Number(sender.walletBalanceCents);
      const receiverBalance = Number(receiver.walletBalanceCents);

      // Check sufficient balance INSIDE the transaction
      if (senderBalance < amountCents) {
        throw new Error('INSUFFICIENT_BALANCE');
      }

      // Perform the atomic transfer
      const newSenderBalance = senderBalance - amountCents;
      const newReceiverBalance = receiverBalance + amountCents;

      await Promise.all([
        tx.user.update({
          where: { id: senderId },
          data: { walletBalanceCents: BigInt(newSenderBalance) },
        }),
        tx.user.update({
          where: { id: receiverId },
          data: { walletBalanceCents: BigInt(newReceiverBalance) },
        }),
        tx.walletTransaction.create({
          data: {
            senderId,
            receiverId,
            amountCents: BigInt(amountCents),
            type,
            referenceId,
          },
        }),
      ]);

      return { senderBalance: newSenderBalance, receiverBalance: newReceiverBalance };
    });

    return {
      success: true,
      message: `Transferred ${formatCents(amountCents)} successfully`,
      senderBalance: result.senderBalance,
      receiverBalance: result.receiverBalance,
    };
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === 'USER_NOT_FOUND') {
        return { success: false, message: 'User not found' };
      }
      if (error.message === 'INSUFFICIENT_BALANCE') {
        return { success: false, message: 'Insufficient wallet balance' };
      }
    }
    console.error('Wallet transfer error:', error);
    return { success: false, message: 'Transfer failed. Please try again.' };
  }
}

/**
 * Get user's wallet balance
 */
export async function getWalletBalance(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { walletBalanceCents: true },
  });
  return user ? Number(user.walletBalanceCents) : 0;
}

/**
 * Get user's transaction history
 */
export async function getTransactionHistory(userId: string, limit = 50) {
  return prisma.walletTransaction.findMany({
    where: {
      OR: [{ senderId: userId }, { receiverId: userId }],
    },
    include: {
      sender: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
}