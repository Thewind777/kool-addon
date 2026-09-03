import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';

interface GroupOrderRoom {
  shareCode: string;
  sockets: Set<string>;
}

const rooms = new Map<string, GroupOrderRoom>();

export function initializeSocketIO(httpServer: HttpServer) {
  const io = new SocketIOServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
    },
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join group order room
    socket.on('join-room', ({ shareCode, userId }) => {
      socket.join(shareCode);
      
      if (!rooms.has(shareCode)) {
        rooms.set(shareCode, { shareCode, sockets: new Set() });
      }
      rooms.get(shareCode)!.sockets.add(socket.id);
      
      socket.data.shareCode = shareCode;
      socket.data.userId = userId;
      
      console.log(`User ${userId} joined room ${shareCode}`);
      
      // Notify others in room
      socket.to(shareCode).emit('user-joined', { userId, socketId: socket.id });
    });

    // Handle item added
    socket.on('item-added', ({ shareCode, item }) => {
      socket.to(shareCode).emit('ITEM_ADDED', item);
    });

    // Handle item removed
    socket.on('item-removed', ({ shareCode, itemId }) => {
      socket.to(shareCode).emit('ITEM_REMOVED', { itemId });
    });

    // Handle cart locked
    socket.on('cart-locked', ({ shareCode, breakdown }) => {
      socket.to(shareCode).emit('CART_LOCKED', { breakdown });
    });

    // Handle checkout completed
    socket.on('checkout-completed', ({ shareCode, transactions }) => {
      io.to(shareCode).emit('CHECKOUT_COMPLETED', { transactions });
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      const { shareCode, userId } = socket.data;
      if (shareCode && rooms.has(shareCode)) {
        rooms.get(shareCode)!.sockets.delete(socket.id);
        if (rooms.get(shareCode)!.sockets.size === 0) {
          rooms.delete(shareCode);
        } else {
          socket.to(shareCode).emit('user-left', { userId, socketId: socket.id });
        }
      }
      console.log(`Client disconnected: ${socket.id}`);
    });
  });

  return io;
}

// Export for use in API routes
export const socketEvents = {
  ITEM_ADDED: 'ITEM_ADDED',
  ITEM_REMOVED: 'ITEM_REMOVED',
  CART_LOCKED: 'CART_LOCKED',
  CHECKOUT_COMPLETED: 'CHECKOUT_COMPLETED',
  USER_JOINED: 'USER_JOINED',
  USER_LEFT: 'USER_LEFT',
} as const;