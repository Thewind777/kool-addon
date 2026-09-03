# Group Order MVP

A mobile-first web application for shared group ordering with real-time cart synchronization and QR code-based peer-to-peer wallet transfers.

## Features

### 🛒 Shared Group Ordering
- **Host Link Generation**: Create a group order and get a unique shareable link
- **Real-time Sync**: Multiple users see cart updates instantly via WebSockets
- **Item Ownership**: Each item tracks who added it (user or guest)
- **Flexible Payment Modes**:
  - Host pays entire bill
  - Each user pays their share from wallet
- **Cart Locking**: Prevent modifications during checkout

### 💳 QR Wallet Transfers
- **Generate QR Codes**: Signed JWT with expiry (prevents replay attacks)
- **Scan & Transfer**: Camera-based QR scanning with html5-qrcode
- **Atomic Transfers**: Database transactions with row-level locks prevent double-spending
- **Balance Management**: All amounts stored in cents (integers) to avoid floating-point errors

## Tech Stack

- **Frontend**: Next.js 14 (App Router), React 18, TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite (dev) / PostgreSQL (prod) with Prisma ORM
- **Real-time**: Socket.io
- **QR Codes**: qrcode (generation), html5-qrcode (scanning)
- **Auth**: JWT (jose library)
- **Testing**: Playwright E2E tests

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Push database schema
npm run db:push

# Seed demo data
npm run db:seed

# Start development server
npm run dev
```

Visit `http://localhost:3000`

### Demo Users
The seed script creates three demo users:
- **Feras** (feras@example.com) - $500.00 balance
- **Ahmed** (ahmed@example.com) - $300.00 balance
- **Sarah** (sarah@example.com) - $200.00 balance

### Demo Group Order
A pre-seeded group order with code `DEMO123456` is available for testing.

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── group-orders/          # Group order CRUD & checkout
│   │   └── wallet/                # Wallet & QR endpoints
│   ├── order/
│   │   ├── create/                # Create group order page
│   │   └── [shareCode]/           # Shared order page
│   ├── wallet/                    # Wallet dashboard page
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── prisma.ts                  # Prisma client
│   ├── utils.ts                   # Helpers (JWT, formatting)
│   ├── wallet.ts                  # Wallet transfer logic
│   ├── group-order.ts             # Group order logic
│   └── socket.ts                  # Socket.io server
├── components/                    # Reusable components
└── types/                         # TypeScript types

prisma/
├── schema.prisma                  # Database schema
└── seed.ts                        # Demo data

tests/
└── group-order.e2e.ts             # Playwright E2E tests
```

## Key Implementation Details

### Financial Arithmetic (Cents-based)
All monetary values are stored and computed as **integers representing cents**:
```typescript
// ✅ Correct
const priceCents = 1500; // $15.00
const total = items.reduce((sum, item) => sum + item.priceCents * item.quantity, 0);

// ❌ Wrong - floating point errors
const price = 15.00;
const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
```

### Atomic Wallet Transfers
```typescript
await prisma.$transaction(async (tx) => {
  // Lock rows FOR UPDATE
  const [sender, receiver] = await Promise.all([
    tx.user.findUnique({ where: { id: senderId } }),
    tx.user.findUnique({ where: { id: receiverId } }),
  ]);
  
  // Check balance INSIDE transaction
  if (sender.walletBalanceCents < amountCents) {
    throw new Error('INSUFFICIENT_BALANCE');
  }
  
  // Atomic updates
  await Promise.all([
    tx.user.update({ where: { id: senderId }, data: { walletBalanceCents: sender.walletBalanceCents - amountCents } }),
    tx.user.update({ where: { id: receiverId }, data: { walletBalanceCents: receiver.walletBalanceCents + amountCents } }),
    tx.walletTransaction.create({ data: { ... } }),
  ]);
});
```

### QR Code Security
- JWT signed with HS256
- Short expiry (default 60 seconds)
- Includes user ID, name, optional requested amount
- Verified server-side before transfer

### Real-time Sync
Socket.io events:
- `ITEM_ADDED` - Broadcast new item to room
- `ITEM_REMOVED` - Broadcast item removal
- `CART_LOCKED` - Broadcast checkout breakdown
- `CHECKOUT_COMPLETED` - Notify payment complete

## API Endpoints

### Group Orders
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/group-orders` | Create group order |
| GET | `/api/group-orders/:shareCode` | Get order state |
| POST | `/api/group-orders/:shareCode/items` | Add item |
| DELETE | `/api/group-orders/:shareCode/items/:id` | Remove item |
| POST | `/api/group-orders/:shareCode/checkout` | Lock cart or process payment |

### Wallet
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/wallet/balance` | Get user balance |
| GET | `/api/wallet/transactions` | Get transaction history |
| POST | `/api/wallet/qr/generate` | Generate QR code |
| POST | `/api/wallet/qr/transfer` | Execute QR transfer |

## Running Tests

```bash
# Run E2E tests
npm run test

# Run tests with UI
npm run test:ui
```

## Environment Variables

Create `.env` from `.env.example`:

```env
DATABASE_URL="file:./dev.db"
QR_JWT_SECRET="your-secret-key-min-32-chars"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
SOCKET_IO_PORT=3001
```

## Production Deployment

1. Switch to PostgreSQL in `prisma/schema.prisma`
2. Set strong `QR_JWT_SECRET`
3. Configure reverse proxy for WebSocket support
4. Run `npm run build && npm run start`

## License

MIT