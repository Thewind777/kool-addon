'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createGroupOrder } from '@/lib/group-order';

const USERS = [
  { id: 'user-feras-001', name: 'Feras' },
  { id: 'user-ahmed-002', name: 'Ahmed' },
  { id: 'user-sarah-003', name: 'Sarah' },
];

export default function CreateOrderPage() {
  const router = useRouter();
  const [selectedHost, setSelectedHost] = useState<string>('');
  const [paymentMode, setPaymentMode] = useState<'HOST_PAYS_ALL' | 'SPLIT_WALLETS'>('HOST_PAYS_ALL');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedHost) {
      setError('Please select a host user');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/group-orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ hostUserId: selectedHost, paymentMode }),
      });

      const data = await response.json();

      if (data.success) {
        router.push(`/order/${data.data.shareCode}`);
      } else {
        setError(data.message || 'Failed to create order');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-md mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Create Group Order</h1>
          <p className="text-gray-600 mt-1">Generate a share link for collaborative ordering</p>
        </div>

        <form onSubmit={handleSubmit} className="card p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Host User
            </label>
            <select
              value={selectedHost}
              onChange={(e) => setSelectedHost(e.target.value)}
              className="input"
              required
            >
              <option value="">Select host...</option>
              {USERS.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Payment Mode
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMode"
                  value="HOST_PAYS_ALL"
                  checked={paymentMode === 'HOST_PAYS_ALL'}
                  onChange={(e) => setPaymentMode(e.target.value as 'HOST_PAYS_ALL' | 'SPLIT_WALLETS')}
                  className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Host pays entire bill</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMode"
                  value="SPLIT_WALLETS"
                  checked={paymentMode === 'SPLIT_WALLETS'}
                  onChange={(e) => setPaymentMode(e.target.value as 'HOST_PAYS_ALL' | 'SPLIT_WALLETS')}
                  className="h-4 w-4 text-primary-600 border-gray-300 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Each user pays their share</span>
              </label>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="btn-primary w-full py-3"
          >
            {loading ? 'Creating...' : 'Create Group Order'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <a href="/" className="text-primary-600 hover:underline text-sm">
            ← Back to Home
          </a>
        </div>
      </div>
    </main>
  );
}