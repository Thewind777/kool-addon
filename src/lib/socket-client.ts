'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export const socketEvents = {
  ITEM_ADDED: 'ITEM_ADDED',
  ITEM_REMOVED: 'ITEM_REMOVED',
  CART_LOCKED: 'CART_LOCKED',
  CHECKOUT_COMPLETED: 'CHECKOUT_COMPLETED',
  USER_JOINED: 'USER_JOINED',
  USER_LEFT: 'USER_LEFT',
} as const;

interface UsePollingOptions {
  shareCode: string;
  enabled?: boolean;
  intervalMs?: number;
  onItemAdded?: (item: any) => void;
  onItemRemoved?: (data: { itemId: string }) => void;
  onCartLocked?: (data: { breakdown: any }) => void;
  onCheckoutCompleted?: (data: { transactions: any }) => void;
  onUserJoined?: (data: any) => void;
  onUserLeft?: (data: any) => void;
}

export function useGroupOrderSocket(options: UsePollingOptions) {
  const { shareCode, enabled = true, intervalMs = 2000, onItemAdded, onItemRemoved, onCartLocked, onCheckoutCompleted, onUserJoined, onUserLeft } = options;
  const [lastItemCount, setLastItemCount] = useState(0);
  const [lastStatus, setLastStatus] = useState<string>('');
  const [connected, setConnected] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const poll = useCallback(async () => {
    if (!enabled || !shareCode) return;

    try {
      const response = await fetch(`/api/group-orders/${shareCode}`);
      if (!response.ok) {
        setConnected(false);
        return;
      }

      const data = await response.json();
      if (!data.success || !data.data) {
        setConnected(false);
        return;
      }

      setConnected(true);
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
      setConnected(false);
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

  // These are no-ops for polling-based approach (handled by API calls)
  const emitItemAdded = useCallback(() => {}, []);
  const emitItemRemoved = useCallback(() => {}, []);
  const emitCartLocked = useCallback(() => {}, []);
  const emitCheckoutCompleted = useCallback(() => {}, []);

  return {
    connected,
    emitItemAdded,
    emitItemRemoved,
    emitCartLocked,
    emitCheckoutCompleted,
  };
}