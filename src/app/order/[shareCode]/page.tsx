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
  { id: 'user-feras-001', name: 'Feras', color: 'bg-blue-500' },
  { id: 'user-ahmed-002', name: 'Ahmed', color: 'bg-green-500' },
  { id: 'user-sarah-003', name: 'Sarah', color: 'bg-purple-500' },
];

/* Predefined menu items with customization options */
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

const cn = (...classes: (string | boolean | undefined)[]) => classes.filter(Boolean).join(' ');

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
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-primary-600 border-t-transparent" />
      </main>
    );
  }

  if (error && !groupOrder) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <div className="text-center px-4">
          <h1 className="text-xl font-semibold text-red-600">{error}</h1>
          <a href="/" className="text-primary-600 mt-4 inline-block flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Back to Home
          </a>
        </div>
      </main>
    );
  }

  if (!groupOrder) return null;

  const isHost = selectedUser === groupOrder.hostUserId;
  const canModify = groupOrder.status === 'OPEN' && selectedUser;

  return (
    <main className="min-h-screen bg-slate-50 pb-8">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-md mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold text-slate-900">Group Order</h1>
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.5v15m7.5-7.5h-15" />
              </svg>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-1">Share code: <span className="font-mono font-medium text-slate-700">{shareCode}</span></p>
        </div>
      </header>

      <div className="max-w-md mx-auto px-4 py-6 space-y-6">
        {/* User Selector */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <label className="block text-sm font-medium text-slate-700 mb-3">Select Your Identity</label>
          <div className="grid grid-cols-3 gap-3">
            {USERS.map((user) => (
              <button
                key={user.id}
                onClick={() => { setSelectedUser(user.id); setIsGuest(false); }}
                className={cn(
                  'relative p-4 rounded-xl border-2 transition-all duration-200 flex flex-col items-center gap-2',
                  selectedUser === user.id
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                )}
                disabled={checkoutStep !== 'idle'}
              >
                <div className={cn('w-12 h-12 rounded-full flex items-center justify-center', user.color)}>
                  <span className="text-white font-medium text-sm">{user.name[0]}</span>
                </div>
                <span className={cn(
                  'text-sm font-medium',
                  selectedUser === user.id ? 'text-primary-600' : 'text-slate-700'
                )}>
                  {user.name}
                </span>
                {selectedUser === user.id && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-primary-500 rounded-full" />
                )}
              </button>
            ))}
          </div>
          
          <div className="mt-4">
            <label className="flex items-center gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors">
              <input
                type="checkbox"
                checked={isGuest}
                onChange={(e) => { setIsGuest(e.target.checked); if (e.target.checked) setSelectedUser(''); }}
                className="h-5 w-5 text-primary-600 border-slate-300 rounded focus:ring-2 focus:ring-primary-500/20"
                disabled={checkoutStep !== 'idle'}
              />
              <span className="text-sm font-medium text-slate-700">I'm a Guest</span>
            </label>
            {isGuest && (
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                placeholder="Guest name"
                className="mt-3 w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-sm transition-all"
                maxLength={100}
              />
            )}
          </div>
        </div>

        {selectedUser && (
          <>
            {/* Cart Items */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="font-semibold text-slate-900">Cart</h2>
                <span className={cn(
                  'px-3 py-1 rounded-full text-xs font-semibold',
                  groupOrder.status === 'OPEN' ? 'bg-green-100 text-green-700' :
                  groupOrder.status === 'LOCKED' ? 'bg-amber-100 text-amber-700' :
                  'bg-green-100 text-green-700'
                )}>
                  {groupOrder.status === 'OPEN' ? 'Open' : groupOrder.status === 'LOCKED' ? 'Locked' : 'Paid'}
                </span>
              </div>
              {groupOrder.items.length === 0 ? (
                <div className="p-12 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-4">
                    <svg className="w-8 h-8 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 11l5 5 5-5" />
                    </svg>
                  </div>
                  <p className="text-slate-500 font-medium">Your cart is empty</p>
                  <p className="text-xs text-slate-400 mt-1">Add items from the menu below</p>
                </div>
              ) : (
                <ul className="divide-y divide-slate-100">
                  {groupOrder.items.map((item) => (
                    <li key={item.id} className="px-5 py-4 flex items-center justify-between hover:bg-slate-50 transition-colors group">
                      <div className="flex-1 min-w-0 pr-4">
                        <p className="font-medium text-slate-900 truncate">{item.itemName}</p>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <span className="text-sm text-slate-500">
                            {formatCents(item.priceCents)} × {item.quantity}
                          </span>
                          {item.user && (
                            <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 text-xs font-medium">
                              {item.user.name}
                            </span>
                          )}
                          {item.guestName && (
                            <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-xs font-medium">
                              {item.guestName}
                            </span>
                          )}
                          {item.notes && (
                            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                              {item.notes}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-slate-900 text-lg">
                          {formatCents(item.priceCents * item.quantity)}
                        </span>
                        {canModify && item.userId === selectedUser && (
                          <button
                            onClick={() => handleRemoveItem(item.id)}
                            className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all"
                          >
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
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
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              {groupOrder.paymentMode === 'SPLIT_WALLETS' && breakdown.length > 0 ? (
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-slate-700">Per User</h4>
                  {breakdown.map((p) => (
                    <div key={p.userId || p.name} className="flex justify-between items-center py-2 px-3 rounded-xl bg-slate-50">
                      <span className="text-slate-700 font-medium">{p.name}</span>
                      <span className="font-semibold text-slate-900">{formatCents(p.totalCents)}</span>
                    </div>
                  ))}
                  <div className="border-t border-slate-200 pt-3 flex justify-between">
                    <span className="text-lg font-medium text-slate-700">Total</span>
                    <span className="text-2xl font-bold text-slate-900">{formatCents(groupOrder.totalAmountCents)}</span>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-baseline mb-2">
                    <span className="text-lg font-medium text-slate-700">Total</span>
                    <span className="text-3xl font-bold text-slate-900">
                      {formatCents(groupOrder.totalAmountCents)}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500">
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
              <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                  <p className="text-sm text-amber-800 font-medium">
                    Cart locked for checkout. Waiting for host to process payment.
                  </p>
                </div>
              </div>
            )}

            {checkoutStep === 'paid' && (
              <div className="bg-green-50 border border-green-200 rounded-2xl p-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
                    <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <p className="text-sm text-green-800 font-semibold">Payment completed successfully!</p>
                </div>
              </div>
            )}

            {/* Share Link */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
              <p className="text-sm font-medium text-slate-700 mb-3">Share this link</p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={`${window.location.origin}/order/${shareCode}`}
                  readOnly
                  className="flex-1 px-4 py-3 rounded-xl border border-slate-200 bg-slate-50 text-sm font-mono focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(`${window.location.origin}/order/${shareCode}`)}
                  className="px-6 py-3 rounded-xl border-2 border-slate-200 bg-white text-slate-700 font-semibold hover:bg-slate-50 hover:border-slate-300 transition-all flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                  </svg>
                  Copy
                </button>
              </div>
            </div>
          </>
        )}
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
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4 animate-fade-in">
      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-primary-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-primary-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h-.08M12 12.5V12m3.249 7.05l4.157-4.157a.4.4 0 00-.566-.565L12 17.883l-3.843-3.843a.4.4 0 00-.566 0L6.05 15.88a.4.4 0 000 .566l4.157 4.157M12 12.5V12" />
          </svg>
        </div>
        <span>Add Items</span>
      </h3>
      <div className="grid grid-cols-2 gap-3">
        {MENU_ITEMS.map(menuItem => {
          const selected = selectedItems[menuItem.id];
          const qty = selected?.quantity || 0;
          return (
            <div key={menuItem.id} className={cn(
              'relative p-4 border-2 rounded-xl transition-all duration-200',
              qty > 0 ? 'border-primary-500 bg-primary-50' : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
            )}>
              <div className="flex items-center justify-between">
                <span className="text-3xl">{menuItem.emoji}</span>
                {qty > 0 && (
                  <div className="absolute -top-2 -right-2 bg-primary-600 text-white text-xs w-6 h-6 rounded-full flex items-center justify-center font-bold">
                    {qty}
                  </div>
                )}
              </div>
              <div className="mt-2">
                <p className="font-medium text-slate-900">{menuItem.name}</p>
                <p className="text-sm text-slate-500">{formatCents(menuItem.priceCents)}</p>
              </div>
              <div className="mt-3 flex items-center gap-2">
                <button
                  onClick={() => toggleItem(menuItem)}
                  className={cn(
                    'flex-1 py-2 rounded-lg text-sm font-medium transition-all',
                    qty > 0 ? 'bg-primary-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  )}
                >
                  {qty > 0 ? 'Added' : 'Add'}
                </button>
                {qty > 0 && (
                  <div className="flex items-center gap-1 bg-slate-100 rounded-lg px-2 py-1">
                    <button onClick={() => updateQuantity(menuItem.id, -1)} className="p-1 text-slate-600 hover:bg-slate-200 rounded">−</button>
                    <span className="w-8 text-center text-sm font-medium text-slate-900">{qty}</span>
                    <button onClick={() => updateQuantity(menuItem.id, 1)} className="p-1 text-slate-600 hover:bg-slate-200 rounded">+</button>
                  </div>
                )}
              </div>
              {qty > 0 && (
                <div className="mt-3 space-y-3 animate-slide-up">
                  <input
                    type="text"
                    value={selected?.notes || ''}
                    onChange={(e) => updateNotes(menuItem.id, e.target.value)}
                    placeholder="Notes (e.g., no pickles)"
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 focus:outline-none text-xs transition-all"
                    maxLength={100}
                  />
                  {menuItem.options && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-slate-700">Options:</p>
                      <div className="flex flex-wrap gap-2">
                        {menuItem.options.map(opt => (
                          <label key={opt.id} className={cn(
                            'flex items-center gap-1.5 cursor-pointer px-3 py-1.5 rounded-lg text-xs transition-all',
                            selected?.options.includes(opt.id)
                              ? 'bg-primary-100 text-primary-700 border border-primary-200'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          )}>
                            <input
                              type="checkbox"
                              checked={selected?.options.includes(opt.id)}
                              onChange={() => toggleOption(menuItem.id, opt.id)}
                              className="h-4 w-4 text-primary-600 border-slate-300 rounded focus:ring-2 focus:ring-primary-500/20"
                            />
                            <span>
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
        <button onClick={handleSubmit} disabled={adding} className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold text-base hover:bg-primary-700 focus:ring-2 focus:ring-primary-500/30 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2">
          {adding ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Adding...
            </>
          ) : (
            `Add ${Object.values(selectedItems).reduce((a, b) => a + b.quantity, 0)} Item(s)`
          )}
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
    <div className="bg-white rounded-2xl shadow-sm border border-amber-200 bg-amber-50 p-5 space-y-5 animate-fade-in">
      <h3 className="font-semibold text-slate-900 flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-amber-100 flex items-center justify-center">
          <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>
        <span>Checkout Breakdown</span>
      </h3>

      <div className="space-y-3">
        {breakdown.map((participant) => (
          <div key={participant.userId || participant.name} className="bg-white rounded-xl p-4 border border-slate-100">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium text-slate-900">{participant.name}</span>
              <span className="font-bold text-slate-900">{formatCents(participant.totalCents)}</span>
            </div>
            <ul className="text-sm text-slate-600 space-y-1">
              {participant.items.map((item) => (
                <li key={item.id} className="flex justify-between py-1">
                  <span>{item.itemName} × {item.quantity}</span>
                  <span>{formatCents(item.priceCents * item.quantity)}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="border-t border-amber-200 pt-4">
        <div className="flex justify-between text-lg font-bold text-slate-900 mb-4">
          <span>Total</span>
          <span>{formatCents(totalAmountCents)}</span>
        </div>
        <button
          onClick={handlePay}
          disabled={processing}
          className="w-full py-3.5 rounded-xl bg-primary-600 text-white font-semibold text-base hover:bg-primary-700 focus:ring-2 focus:ring-primary-500/30 focus:outline-none transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {processing ? (
            <>
              <svg className="animate-spin w-5 h-5" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              Processing...
            </>
          ) : (
            'Confirm & Pay'
          )}
        </button>
      </div>
    </div>
  );
}