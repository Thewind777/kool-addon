'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export const realtimeEvents = {
  ITEM_ADDED: 'ITEM_ADDED',
  ITEM_REMOVED: 'ITEM_REMOVED',
  CART_LOCKED: 'CART_LOCKED',
  CHECKOUT_COMPLETED: 'CHECKOUT_COMPLETED',
} as const;

interface UsePollingOptions {
  shareCode: string;
  enabled?: boolean;
  intervalMs?: number;
  onItemAdded?: (item: any) => void;
  onItemRemoved?: (data: { itemId: string }) => void;
  onCartLocked?: (data: { breakdown: any }) => void;
  onCheckoutCompleted?: (data: { transactions: any }) => void;
}

export function useGroupOrderPolling(options: UsePollingOptions) {
  const { shareCode, enabled = true, intervalMs = 2000, onItemAdded, onItemRemoved, onCartLocked, onCheckoutCompleted } = options;
  const [lastItemCount, setLastItemCount] = useState(0);
  const [lastStatus, setLastStatus] = useState<string>('');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    if (!enabled || !shareCode) return;

    try {
      const response = await fetch(`/api/group-orders/${shareCode}`);
      if (!response.ok) return;

      const data = await response.json();
      if (!data.success || !data.data) return;

      const { items, status, breakdown } = data.data;

      // Detect new items
      if (items.length > lastItemCount) {
        const newItems = items.slice(lastItemCount);
        newItems.forEach((item: any) => onItemAdded?.(item));
      }
      setLastItemCount(items.length);

      // Detect status changes
      if (status !== lastStatus) {
        if (status === 'LOCKED' && breakdown) {
          onCartLocked?.({ breakdown });
        }
        if (status === 'PAID') {
          onCheckoutCompleted?.({ transactions: [] });
        }
        setLastStatus(status);
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, [shareCode, enabled, lastItemCount, lastStatus, onItemAdded, onItemRemoved, onCartLocked, onCheckoutCompleted]);

  useEffect(() => {
    if (!enabled) return;

    // Initial fetch
    poll();

    // Set up interval
    intervalRef.current = setInterval(poll, intervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [enabled, poll, intervalMs]);

  return { poll };
}