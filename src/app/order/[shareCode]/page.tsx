'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { formatCents } from '@/lib/utils';
import { useGroupOrderPolling } from '@/lib/realtime';

interface GroupOrderItem {
  id: string;
  groupOrderId: string;
  userId: string | null;
  guestName: string | null;
  itemId: string;
  itemName: string;
  priceCents: number;
  quantity: number;
  createdAt: string;
  user?: { id: string; name: string } | null;
}

interface GroupOrder {
  id: string;
  shareCode: string;
  hostUserId: string;
  status: string;
  paymentMode: string;
  totalAmountCents: number;
  createdAt: string;
  items: GroupOrderItem[];
  host: { id: string; name: string };
}

interface ParticipantBreakdown {
  userId: string | null;
  name: string;
  isGuest: boolean;
  items: GroupOrderItem[];
  totalCents: number;
}

const USERS = [
  { id: 'feras-uuid', name: 'Feras' },
  { id: 'ahmed-uuid', name: 'Ahmed' },
  { id: 'sarah-uuid', name: 'Sarah' },
];

export default function GroupOrderPage() {
  const params = useParams();
  const router = useRouter();
  const shareCode = params.shareCode as string;

  const [groupOrder, setGroupOrder] = useState<GroupOrder | null>(null);
  const [breakdown, setBreakdown] = useState<ParticipantBreakdown[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [isGuest, setIsGuest] = useState(false);
  const [guestName, setGuestName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkoutStep, setCheckoutStep] = useState<'idle' | 'locked' | 'paid'>('idle');

  // Initialize polling for real-time updates
  useGroupOrderPolling({
    shareCode,
    enabled: !!shareCode,
    intervalMs: 2000,
    onItemAdded: (item: GroupOrderItem) => {
      setGroupOrder((prev) => {
        if (!prev) return prev;
        // Avoid duplicates
        if (prev.items.some(i => i.id === item.id)) return prev;
        return { ...prev, items: [...prev.items, item] };
      });
    },
    onItemRemoved: ({ itemId }: { itemId: string }) => {
      setGroupOrder((prev) => {
        if (!prev) return prev;
        return { ...prev, items: prev.items.filter((i) => i.id !== itemId) };
      });
    },
    onCartLocked: ({ breakdown: newBreakdown }: { breakdown: ParticipantBreakdown[] }) => {
      setBreakdown(newBreakdown);
      setCheckoutStep('locked');
    },
    onCheckoutCompleted: () => {
      setCheckoutStep('paid');
      fetchGroupOrder();
    },
  });

  // Fetch group order data
  const fetchGroupOrder = useCallback(async () => {
    try {
      const response = await fetch(`/api/group-orders/${shareCode}`);
      const data = await response.json();

      if (data.success) {
        setGroupOrder(data.data);
        if (data.data.breakdown) {
          setBreakdown(data.data.breakdown);
        }
        if (data.data.status === 'LOCKED') setCheckoutStep('locked');
        if (data.data.status === 'PAID') setCheckoutStep('paid');
      } else {
        setError(data.message || 'Group order not found');
      }
    } catch (err) {
      setError('Failed to load group order');
    } finally {
      setLoading(false);
    }
  }, [shareCode]);

  useEffect(() => {
    fetchGroupOrder();
  }, [fetchGroupOrder]);

  // Add item
  const handleAddItem = async (itemData: Omit<GroupOrderItem, 'id' | 'groupOrderId' | 'createdAt' | 'user'>) => {
    try {
      const response = await fetch(`/api/group-orders/${shareCode}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...itemData,
          userId: isGuest ? undefined : selectedUser,
          guestName: isGuest ? guestName : undefined,
        }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || 'Failed to add item');
        return false;
      }

      // Polling will pick up the new item automatically
      return true;
    } catch (err) {
      setError('Network error');
      return false;
    }
  };

  // Remove item
  const handleRemoveItem = async (itemId: string) => {
    try {
      const response = await fetch(`/api/group-orders/${shareCode}/items/${itemId}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || 'Failed to remove item');
        return false;
      }

      // Polling will pick up the removal
      return true;
    } catch (err) {
      setError('Network error');
      return false;
    }
  };

  // Lock cart for checkout
  const handleLockCart = async () => {
    try {
      const response = await fetch(`/api/group-orders/${shareCode}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostUserId: selectedUser, action: 'lock' }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || 'Failed to lock cart');
        return false;
      }

      return true;
    } catch (err) {
      setError('Network error');
      return false;
    }
  };

  // Process payment
  const handleProcessPayment = async () => {
    try {
      const response = await fetch(`/api/group-orders/${shareCode}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostUserId: selectedUser, action: 'pay' }),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.message || 'Payment failed');
        return false;
      }

      return true;
    } catch (err) {
      setError('Network error');
      return false;
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent"></div>
      </main>
    );
  }

  if (error && !groupOrder) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-semibold text-red-600">{error}</h1>
          <a href="/" className="text-primary-600 mt-4 inline-block">← Back to Home</a>
        </div>
      </main>
    );
  }

  if (!groupOrder) return null;

  const isHost = selectedUser === groupOrder.hostUserId;
  const canModify = groupOrder.status === 'OPEN' && selectedUser;

  return (
    <main className="min-h-screen bg-gray-50 pb-12">
      <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <h1 className="font-semibold text-gray-900">Group Order</h1>
            <span className="text-xs text-gray-500">Code: {shareCode}</span>
          </div>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-4">
        {/* User Selector */}
        <div className="card p-4 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Select Your Identity</label>
          <div className="flex items-center space-x-2">
            <select
              value={selectedUser}
              onChange={(e) => {
                setSelectedUser(e.target.value);
                setIsGuest(false);
              }}
              className="input flex-1"
              disabled={checkoutStep !== 'idle'}
            >
              <option value="">Select user...</option>
              {USERS.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={isGuest}
                onChange={(e) => {
                  setIsGuest(e.target.checked);
                  if (e.target.checked) setSelectedUser('');
                }}
                className="h-4 w-4 text-primary-600 border-gray-300"
              />
              <span className="text-sm text-gray-700">Guest</span>
            </label>
          </div>
          {isGuest && (
            <input
              type="text"
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              placeholder="Guest name"
              className="input mt-2"
              maxLength={100}
            />
          )}
        </div>

        {/* Cart Items */}
        <div className="card mb-4">
          <div className="p-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Items ({groupOrder.items.length})</h2>
          </div>
          {groupOrder.items.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <svg className="w-12 h-12 mx-auto mb-2 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11l5 5 5-5" />
              </svg>
              <p>No items yet. Add your first item below.</p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {groupOrder.items.map((item) => (
                <li key={item.id} className="p-4 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 truncate">{item.itemName}</p>
                    <p className="text-sm text-gray-500">
                      {formatCents(item.priceCents)} × {item.quantity}
                      {item.user && <span className="ml-2 text-primary-600">({item.user.name})</span>}
                      {item.guestName && <span className="ml-2 text-amber-600">({item.guestName})</span>}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-semibold text-gray-900">
                      {formatCents(item.priceCents * item.quantity)}
                    </span>
                    {canModify && item.userId === selectedUser && (
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Add Item Form */}
        {canModify && (
          <AddItemForm
            onAddItem={handleAddItem}
            isGuest={isGuest}
            guestName={guestName}
            selectedUser={selectedUser}
          />
        )}

        {/* Total */}
        <div className="card p-4 mb-4 bg-gray-50">
          <div className="flex justify-between items-baseline">
            <span className="text-lg font-medium text-gray-700">Total</span>
            <span className="text-2xl font-bold text-gray-900">
              {formatCents(groupOrder.totalAmountCents)}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {groupOrder.paymentMode === 'HOST_PAYS_ALL' 
              ? `Host (${groupOrder.host.name}) pays entire amount`
              : 'Each user pays their share'}
          </p>
        </div>

        {/* Checkout Section */}
        {checkoutStep === 'locked' && isHost && (
          <CheckoutLockedView
            breakdown={breakdown}
            totalAmountCents={groupOrder.totalAmountCents}
            onProcessPayment={handleProcessPayment}
          />
        )}

        {checkoutStep === 'locked' && !isHost && (
          <div className="card p-4 bg-amber-50 border-amber-200">
            <p className="text-sm text-amber-800 text-center">
              Cart locked for checkout. Waiting for host to process payment.
            </p>
          </div>
        )}

        {checkoutStep === 'paid' && (
          <div className="card p-4 bg-green-50 border-green-200">
            <p className="text-sm text-green-800 text-center font-medium">
              ✅ Payment completed successfully!
            </p>
          </div>
        )}

        {/* Share Link */}
        <div className="card p-4">
          <p className="text-sm font-medium text-gray-700 mb-2">Share this link:</p>
          <div className="flex space-x-2">
            <input
              type="text"
              value={`${window.location.origin}/order/${shareCode}`}
              readOnly
              className="input flex-1 bg-gray-50"
            />
            <button
              onClick={() => navigator.clipboard.writeText(`${window.location.origin}/order/${shareCode}`)}
              className="btn-secondary"
            >
              Copy
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

// Add Item Form Component
function AddItemForm({
  onAddItem,
  isGuest,
  guestName,
  selectedUser,
}: {
  onAddItem: (item: Omit<GroupOrderItem, 'id' | 'groupOrderId' | 'createdAt' | 'user'>) => Promise<boolean>;
  isGuest: boolean;
  guestName: string;
  selectedUser: string;
}) {
  const [itemName, setItemName] = useState('');
  const [price, setPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [adding, setAdding] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !price) return;

    const priceCents = Math.round(parseFloat(price) * 100);
    if (priceCents <= 0) return;

    setAdding(true);
    const success = await onAddItem({
      userId: isGuest ? null : selectedUser,
      guestName: isGuest ? guestName : null,
      itemId: `ITEM-${Date.now()}`,
      itemName,
      priceCents,
      quantity,
    });

    if (success) {
      setItemName('');
      setPrice('');
      setQuantity(1);
    }
    setAdding(false);
  };

  return (
    <form onSubmit={handleSubmit} className="card p-4 space-y-3">
      <h3 className="font-medium text-gray-900">Add Item</h3>
      <div className="grid grid-cols-2 gap-3">
        <input
          type="text"
          value={itemName}
          onChange={(e) => setItemName(e.target.value)}
          placeholder="Item name"
          className="input"
          maxLength={255}
        />
        <div className="flex space-x-2">
          <input
            type="number"
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            placeholder="Price (e.g., 15.00)"
            className="input flex-1"
            step="0.01"
            min="0.01"
          />
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(parseInt(e.target.value) || 1)}
            className="input w-16"
            min="1"
            max="99"
          />
        </div>
      </div>
      <button type="submit" disabled={adding || !itemName || !price} className="btn-primary w-full">
        {adding ? 'Adding...' : 'Add Item'}
      </button>
    </form>
  );
}

// Checkout Locked View Component
function CheckoutLockedView({
  breakdown,
  totalAmountCents,
  onProcessPayment,
}: {
  breakdown: ParticipantBreakdown[];
  totalAmountCents: number;
  onProcessPayment: () => Promise<boolean>;
}) {
  const [processing, setProcessing] = useState(false);

  const handlePay = async () => {
    setProcessing(true);
    const success = await onProcessPayment();
    setProcessing(false);
  };

  return (
    <div className="card p-4 space-y-4 border-amber-200 bg-amber-50">
      <h3 className="font-semibold text-gray-900 flex items-center space-x-2">
        <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span>Checkout Breakdown</span>
      </h3>

      <div className="space-y-2">
        {breakdown.map((participant) => (
          <div key={participant.userId || participant.name} className="p-3 bg-white rounded-lg border">
            <div className="flex justify-between items-center mb-1">
              <span className="font-medium text-gray-900">{participant.name}</span>
              <span className="font-bold text-gray-900">{formatCents(participant.totalCents)}</span>
            </div>
            <ul className="text-sm text-gray-600 space-y-1">
              {participant.items.map((item) => (
                <li key={item.id} className="flex justify-between">
                  <span>{item.itemName} × {item.quantity}</span>
                  <span>{formatCents(item.priceCents * item.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-amber-200 pt-3">
        <div className="flex justify-between text-lg font-bold text-gray-900 mb-3">
          <span>Total</span>
          <span>{formatCents(totalAmountCents)}</span>
        </div>
        <button
          onClick={handlePay}
          disabled={processing}
          className="btn-primary w-full py-3"
        >
          {processing ? 'Processing...' : 'Confirm & Pay'}
        </button>
      </div>
    </div>
  );
}