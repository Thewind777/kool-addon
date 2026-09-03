import { prisma } from './prisma';
import { formatCents, generateShareCode } from './utils';

export interface GroupOrderWithItems {
  id: string;
  shareCode: string;
  hostUserId: string;
  status: string;
  paymentMode: string;
  totalAmountCents: number;
  createdAt: Date;
  items: GroupOrderItemWithUser[];
  host: { id: string; name: string };
}

export interface GroupOrderItemWithUser {
  id: string;
  groupOrderId: string;
  userId: string | null;
  guestName: string | null;
  itemId: string;
  itemName: string;
  priceCents: number;
  quantity: number;
  createdAt: Date;
  user?: { id: string; name: string } | null;
}

export interface ParticipantBreakdown {
  userId: string | null;
  name: string;
  isGuest: boolean;
  items: GroupOrderItemWithUser[];
  totalCents: number;
}

/**
 * Create a new group order
 */
export async function createGroupOrder(
  hostUserId: string,
  paymentMode: 'HOST_PAYS_ALL' | 'SPLIT_WALLETS' = 'HOST_PAYS_ALL'
): Promise<GroupOrderWithItems> {
  const shareCode = generateShareCode();
  
  const groupOrder = await prisma.groupOrder.create({
    data: {
      shareCode,
      hostUserId,
      paymentMode,
      status: 'OPEN',
      totalAmountCents: 0,
    },
    include: {
      host: { select: { id: true, name: true } },
      items: {
        include: { user: { select: { id: true, name: true } } },
      },
    },
  });

  return {
    ...groupOrder,
    totalAmountCents: Number(groupOrder.totalAmountCents),
    items: groupOrder.items.map(item => ({
      ...item,
      priceCents: Number(item.priceCents),
    })),
  };
}

/**
 * Get group order by share code with all items and participant breakdown
 */
export async function getGroupOrderByShareCode(shareCode: string): Promise<GroupOrderWithItems | null> {
  const groupOrder = await prisma.groupOrder.findUnique({
    where: { shareCode },
    include: {
      host: { select: { id: true, name: true } },
      items: {
        include: { user: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!groupOrder) return null;

  return {
    ...groupOrder,
    totalAmountCents: Number(groupOrder.totalAmountCents),
    items: groupOrder.items.map(item => ({
      ...item,
      priceCents: Number(item.priceCents),
    })),
  };
}

/**
 * Add an item to a group order
 */
export async function addItemToGroupOrder(
  shareCode: string,
  itemData: {
    userId?: string;
    guestName?: string;
    itemId: string;
    itemName: string;
    priceCents: number;
    quantity?: number;
  }
): Promise<GroupOrderItemWithUser | null> {
  const groupOrder = await prisma.groupOrder.findUnique({
    where: { shareCode },
    select: { id: true, status: true },
  });

  if (!groupOrder) return null;
  if (groupOrder.status !== 'OPEN') {
    throw new Error('CART_LOCKED');
  }

  const item = await prisma.groupOrderItem.create({
    data: {
      groupOrderId: groupOrder.id,
      userId: itemData.userId,
      guestName: itemData.guestName,
      itemId: itemData.itemId,
      itemName: itemData.itemName,
      priceCents: BigInt(itemData.priceCents),
      quantity: itemData.quantity || 1,
    },
    include: { user: { select: { id: true, name: true } } },
  });

  // Recalculate total
  await recalculateGroupOrderTotal(groupOrder.id);

  return {
    ...item,
    priceCents: Number(item.priceCents),
  };
}

/**
 * Remove an item from a group order
 */
export async function removeItemFromGroupOrder(
  shareCode: string,
  itemId: string
): Promise<boolean> {
  const groupOrder = await prisma.groupOrder.findUnique({
    where: { shareCode },
    select: { id: true, status: true },
  });

  if (!groupOrder) return false;
  if (groupOrder.status !== 'OPEN') {
    throw new Error('CART_LOCKED');
  }

  const deleted = await prisma.groupOrderItem.deleteMany({
    where: {
      id: itemId,
      groupOrderId: groupOrder.id,
    },
  });

  if (deleted.count > 0) {
    await recalculateGroupOrderTotal(groupOrder.id);
    return true;
  }

  return false;
}

/**
 * Recalculate group order total amount
 */
async function recalculateGroupOrderTotal(groupOrderId: string): Promise<void> {
  const items = await prisma.groupOrderItem.findMany({
    where: { groupOrderId },
    select: { priceCents: true, quantity: true },
  });

  const total = items.reduce((sum, item) => sum + Number(item.priceCents) * item.quantity, 0);

  await prisma.groupOrder.update({
    where: { id: groupOrderId },
    data: { totalAmountCents: BigInt(total) },
  });
}

/**
 * Lock cart for checkout (prevent further modifications)
 */
export async function lockGroupOrderForCheckout(shareCode: string): Promise<GroupOrderWithItems | null> {
  const groupOrder = await prisma.groupOrder.findUnique({
    where: { shareCode },
    select: { id: true, status: true },
  });

  if (!groupOrder) return null;
  if (groupOrder.status !== 'OPEN') {
    throw new Error('ALREADY_LOCKED');
  }

  await prisma.groupOrder.update({
    where: { id: groupOrder.id },
    data: { status: 'LOCKED' },
  });

  return getGroupOrderByShareCode(shareCode);
}

/**
 * Calculate participant breakdown for checkout
 */
export async function getParticipantBreakdown(shareCode: string): Promise<ParticipantBreakdown[]> {
  const groupOrder = await getGroupOrderByShareCode(shareCode);
  if (!groupOrder) return [];

  const participantMap = new Map<string, ParticipantBreakdown>();

  for (const item of groupOrder.items) {
    const key = item.userId || `guest_${item.guestName}`;
    const name = item.user?.name || item.guestName || 'Unknown';
    const isGuest = !item.userId;

    if (!participantMap.has(key)) {
      participantMap.set(key, {
        userId: item.userId || null,
        name,
        isGuest,
        items: [],
        totalCents: 0,
      });
    }

    const participant = participantMap.get(key)!;
    participant.items.push(item);
    participant.totalCents += Number(item.priceCents) * item.quantity;
  }

  return Array.from(participantMap.values());
}

/**
 * Process group order payment
 */
export async function processGroupOrderPayment(
  shareCode: string,
  hostUserId: string
): Promise<{ success: boolean; message: string; transactions?: any[] }> {
  const groupOrder = await prisma.groupOrder.findUnique({
    where: { shareCode },
    include: {
      items: { include: { user: { select: { id: true, name: true } } } },
    },
  });

  if (!groupOrder) {
    return { success: false, message: 'Group order not found' };
  }

  if (groupOrder.hostUserId !== hostUserId) {
    return { success: false, message: 'Only host can process payment' };
  }

  if (groupOrder.status !== 'LOCKED') {
    return { success: false, message: 'Cart must be locked before payment' };
  }

  const breakdown = await getParticipantBreakdown(shareCode);
  const transactions = [];

  try {
    if (groupOrder.paymentMode === 'HOST_PAYS_ALL') {
      // Host pays entire amount
      const hostBalance = await prisma.user.findUnique({
        where: { id: hostUserId },
        select: { walletBalanceCents: true },
      });

      if (!hostBalance || Number(hostBalance.walletBalanceCents) < Number(groupOrder.totalAmountCents)) {
        return { success: false, message: 'Host has insufficient balance' };
      }

      // Deduct from host
      await prisma.user.update({
        where: { id: hostUserId },
        data: { walletBalanceCents: BigInt(Number(hostBalance.walletBalanceCents) - Number(groupOrder.totalAmountCents)) },
      });

      // Create transaction record
      const tx = await prisma.walletTransaction.create({
        data: {
          senderId: hostUserId,
          receiverId: hostUserId, // Self-transaction for record keeping
          amountCents: groupOrder.totalAmountCents,
          type: 'GROUP_ORDER_PAYMENT',
          referenceId: groupOrder.id,
        },
      });
      transactions.push(tx);
    } else {
      // SPLIT_WALLETS: Each participant pays their share
      for (const participant of breakdown) {
        if (participant.isGuest) continue; // Guests can't pay from wallet

        const user = await prisma.user.findUnique({
          where: { id: participant.userId! },
          select: { walletBalanceCents: true },
        });

        if (!user || Number(user.walletBalanceCents) < participant.totalCents) {
          return { 
            success: false, 
            message: `${participant.name} has insufficient balance (needs ${formatCents(participant.totalCents)})` 
          };
        }

        // Deduct from participant
        await prisma.user.update({
          where: { id: participant.userId! },
          data: { walletBalanceCents: BigInt(Number(user.walletBalanceCents) - participant.totalCents) },
        });

        // Create transaction record
        const tx = await prisma.walletTransaction.create({
          data: {
            senderId: participant.userId!,
            receiverId: hostUserId, // Money goes to host
            amountCents: BigInt(participant.totalCents),
            type: 'GROUP_ORDER_PAYMENT',
            referenceId: groupOrder.id,
          },
        });
        transactions.push(tx);
      }
    }

    // Mark order as paid
    await prisma.groupOrder.update({
      where: { id: groupOrder.id },
      data: { status: 'PAID' },
    });

    return { success: true, message: 'Payment processed successfully', transactions };
  } catch (error) {
    console.error('Payment processing error:', error);
    return { success: false, message: 'Payment failed. Please try again.' };
  }
}