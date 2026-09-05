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
  notes?: string;
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
  { id: 'user-feras-001', name: 'Feras' },
  { id: 'user-ahmed-002', name: 'Ahmed' },
  { id: 'user-sarah-003', name: 'Sarah' },
];

{/* Predefined menu items with customization options */}
const MENU_ITEMS = [
  { 
    id: 'burger', 
    name: 'Burger', 
    priceCents: 1500, 
    emoji: '🍔',
    options: [
      { id: 'no_cheese', label: 'No cheese', priceCents: 0 },
      { id: 'no_pickles', label: 'No pickles', priceCents: 0 },
      { id: 'extra_cheese', label: 'Extra cheese', priceCents: 100 },
      { id: 'bacon', label: 'Add bacon', priceCents: 200 },
    ]
  },
  { 
    id: 'pizza', 
    name: 'Pizza', 
    priceCents: 2000, 
    emoji: '🍕',
    options: [
      { id: 'no_cheese', label: 'No cheese', priceCents: 0 },
      { id: 'extra_cheese', label: 'Extra cheese', priceCents: 150 },
      { id: 'pepperoni', label: 'Add pepperoni', priceCents: 200 },
      { id: 'mushrooms', label: 'Add mushrooms', priceCents: 100 },
    ]
  },
  { 
    id: 'kebab', 
    name: 'Kebab', 
    priceCents: 1800, 
    emoji: '🥙',
    options: [
      { id: 'no_onions', label: 'No onions', priceCents: 0 },
      { id: 'no_sauce', label: 'No sauce', priceCents: 0 },
      { id: 'extra_meat', label: 'Extra meat', priceCents: 300 },
      { id: 'spicy', label: 'Spicy', priceCents: 0 },
    ]
  },
  { 
    id: 'drink', 
    name: 'Drink', 
    priceCents: 500, 
    emoji: '🥤',
    options: [
      { id: 'coke', label: 'Coke', priceCents: 0 },
      { id: 'sprite', label: 'Sprite', priceCents: 0 },
      { id: 'water', label: 'Water', priceCents: 0 },
      { id: 'no_ice', label: 'No ice', priceCents: 0 },
    ]
  },
];

interface SelectedItem {
  quantity: number;
  notes: string;
  options: string[];
}

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
          {groupOrder.paymentMode === 'SPLIT_WALLETS' && breakdown.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700">Per User:</h4>
              {breakdown.map((p) => (
                <div key={p.userId || p.name} className="flex justify-between text-sm">
                  <span className="text-gray-700">{p.name}</span>
                  <span className="font-semibold text-gray-900">{formatCents(p.totalCents)}</span>
                </div>
              ))}
              <div className="border-t border-gray-200 pt-2 flex justify-between">
                <span className="text-lg font-medium text-gray-700">Total</span>
                <span className="text-2xl font-bold text-gray-900">{formatCents(groupOrder.totalAmountCents)}</span>
              </div>
            </div>
          ) : (
            <>
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
            </>
          )}
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
  const [selectedItems, setSelectedItems] = useState<Record<string, SelectedItem>>({});
  const [adding, setAdding] = useState(false);

  const toggleItem = (menuItem: typeof MENU_ITEMS[0]) => {
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[menuItem.id]) {
        if (next[menuItem.id].quantity > 1) {
          next[menuItem.id].quantity -= 1;
        } else {
          delete next[menuItem.id];
        }
      } else {
        next[menuItem.id] = { quantity: 1, notes: '', options: [] };
      }
      return next;
    });
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setSelectedItems(prev => {
      const next = { ...prev };
      if (!next[itemId]) return next;
      next[itemId].quantity = Math.max(1, next[itemId].quantity + delta);
      return next;
    });
  };

  const updateNotes = (itemId: string, notes: string) => {
    setSelectedItems(prev => {
      const next = { ...prev };
      if (next[itemId]) next[itemId].notes = notes;
      return next;
    });
  };

  const toggleOption = (itemId: string, optionId: string) => {
    setSelectedItems(prev => {
      const next = { ...prev };
      if (!next[itemId]) return next;
      const opts = next[itemId].options;
      next[itemId].options = opts.includes(optionId) 
        ? opts.filter(o => o !== optionId)
        : [...opts, optionId];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (Object.keys(selectedItems).length === 0) return;

    setAdding(true);
    try {
      for (const [itemId, { quantity, notes, options }] of Object.entries(selectedItems)) {
        const menuItem = MENU_ITEMS.find(m => m.id === itemId);
        if (!menuItem) continue;

        // Calculate extra price from options
        let extraPrice = 0;
        if (menuItem.options) {
          extraPrice = menuItem.options
            .filter(opt => options.includes(opt.id))
            .reduce((sum, opt) => sum + opt.priceCents, 0);
        }

        const finalPrice = menuItem.priceCents + extraPrice;
        const optionLabels = menuItem.options
          ?.filter(opt => options.includes(opt.id))
          .map(opt => opt.label)
          .join(', ') || '';

        const combinedNotes = [notes, optionLabels].filter(Boolean).join('; ');

        await onAddItem({
          userId: isGuest ? null : selectedUser,
          guestName: isGuest ? guestName : null,
          itemId: menuItem.id,
          itemName: menuItem.name,
          priceCents: finalPrice,
          quantity,
          notes: combinedNotes,
        });
      }
      setSelectedItems({});
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="card p-4 space-y-3">
      <h3 className="font-medium text-gray-900">Add Items</h3>
      <div className="grid grid-cols-2 gap-3">
        {MENU_ITEMS.map(menuItem => {
          const selected = selectedItems[menuItem.id];
          const qty = selected?.quantity || 0;
          return (
            <div key={menuItem.id} className={`relative p-3 border-2 rounded-lg transition-colors ${qty > 0 ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
              <div className="flex items-center justify-between">
                <span className="text-2xl">{menuItem.emoji}</span>
                {qty > 0 && (
                  <div className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                    {qty}
                  </div>
                )}
              </div>
              <div className="mt-1">
                <p className="font-medium text-gray-900">{menuItem.name}</p>
                <p className="text-sm text-gray-500">{formatCents(menuItem.priceCents)}</p>
              </div>
              <div className="mt-2 flex items-center space-x-2">
                <button
                  onClick={() => toggleItem(menuItem)}
                  className={`flex-1 py-1.5 rounded text-sm font-medium ${qty > 0 ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                >
                  {qty > 0 ? 'Added' : 'Add'}
                </button>
                {qty > 0 && (
                  <div className="flex items-center space-x-1">
                    <button onClick={() => updateQuantity(menuItem.id, -1)} className="p-1 text-gray-600 hover:bg-gray-100 rounded">−</button>
                    <span className="w-8 text-center text-sm font-medium">{qty}</span>
                    <button onClick={() => updateQuantity(menuItem.id, 1)} className="p-1 text-gray-600 hover:bg-gray-100 rounded">+</button>
                  </div>
                )}
              </div>
              {qty > 0 && (
                <div className="mt-2 space-y-2">
                  <input
                    type="text"
                    value={selected?.notes || ''}
                    onChange={(e) => updateNotes(menuItem.id, e.target.value)}
                    placeholder="Notes (e.g., no pickles)"
                    className="input text-xs"
                    maxLength={100}
                  />
                  {menuItem.options && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium text-gray-700">Options:</p>
                      <div className="flex flex-wrap gap-1">
                        {menuItem.options.map(opt => (
                          <label key={opt.id} className="flex items-center space-x-1 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={selected?.options.includes(opt.id)}
                              onChange={() => toggleOption(menuItem.id, opt.id)}
                              className="h-3 w-3 text-primary-600 border-gray-300 rounded"
                            />
                            <span className="text-xs text-gray-700">
                              {opt.label}{opt.priceCents > 0 && ` (+${formatCents(opt.priceCents)})`}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {Object.keys(selectedItems).length > 0 && (
        <button onClick={handleSubmit} disabled={adding} className="btn-primary w-full py-2">
          {adding ? 'Adding...' : `Add ${Object.values(selectedItems).reduce((a, b) => a + b.quantity, 0)} Item(s)`}
        </button>
      )}
    </div>
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