'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export const socketEvents = {
  ITEM_ADDED: 'ITEM_ADDED',
  ITEM_REMOVED: 'ITEM_REMOVED',
  CART_LOCKED: 'CART_LOCKED',
  CHECKOUT_COMPLETED: 'CHECKOUT_COMPLETED',
  USER_JOINED: 'USER_JOINED',
  USER_LEFT: 'USER_LEFT',
} as const;

interface UseSocketOptions {
  shareCode: string;
  userId: string;
  onItemAdded?: (item: any) => void;
  onItemRemoved?: (data: { itemId: string }) => void;
  onCartLocked?: (data: { breakdown: any }) => void;
  onCheckoutCompleted?: (data: { transactions: any }) => void;
  onUserJoined?: (data: any) => void;
  onUserLeft?: (data: any) => void;
}

export function useGroupOrderSocket(options: UseSocketOptions) {
  const { shareCode, userId, onItemAdded, onItemRemoved, onCartLocked, onCheckoutCompleted, onUserJoined, onUserLeft } = options;
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!shareCode || !userId) return;

    const socket = io(process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
      socket.emit('join-room', { shareCode, userId });
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    socket.on(socketEvents.ITEM_ADDED, (item) => {
      onItemAdded?.(item);
    });

    socket.on(socketEvents.ITEM_REMOVED, ({ itemId }) => {
      onItemRemoved?.(itemId);
    });

    socket.on(socketEvents.CART_LOCKED, ({ breakdown }) => {
      onCartLocked?.(breakdown);
    });

    socket.on(socketEvents.CHECKOUT_COMPLETED, ({ transactions }) => {
      onCheckoutCompleted?.(transactions);
    });

    socket.on('user-joined', (data) => {
      onUserJoined?.(data);
    });

    socket.on('user-left', (data) => {
      onUserLeft?.(data);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [shareCode, userId, onItemAdded, onItemRemoved, onCartLocked, onCheckoutCompleted, onUserJoined, onUserLeft]);

  const emitItemAdded = useCallback((item: any) => {
    socketRef.current?.emit('item-added', { shareCode, item });
  }, [shareCode]);

  const emitItemRemoved = useCallback((itemId: string) => {
    socketRef.current?.emit('item-removed', { shareCode, itemId });
  }, [shareCode]);

  const emitCartLocked = useCallback((breakdown: any) => {
    socketRef.current?.emit('cart-locked', { shareCode, breakdown });
  }, [shareCode]);

  const emitCheckoutCompleted = useCallback((transactions: any) => {
    socketRef.current?.emit('checkout-completed', { shareCode, transactions });
  }, [shareCode]);

  return {
    connected,
    emitItemAdded,
    emitItemRemoved,
    emitCartLocked,
    emitCheckoutCompleted,
  };
}