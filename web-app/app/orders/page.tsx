'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

interface Order {
  _id: string;
  items: { name: string; price: number; quantity: number }[];
  totalAmount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800',
  paid: 'bg-blue-100 text-blue-800',
  shipped: 'bg-purple-100 text-purple-800',
  completed: 'bg-green-100 text-green-800',
  cancelled: 'bg-red-100 text-red-800',
};

export default function OrdersPage() {
  const { user, isLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    apiFetch('/api/orders/my')
      .then(r => r.json())
      .then(data => { if (data.success) setOrders(data.orders); })
      .finally(() => setLoading(false));
  }, [user]);

  if (!isLoading && !user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 text-center">
        <div><Link href="/login" className="text-blue-600 hover:underline">Log in</Link> to see your orders.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Your Orders</h1>
          <Link href="/orders/selling" className="text-sm text-blue-600 hover:underline">Selling &rarr;</Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-gray-500">No orders yet. <Link href="/marketplace" className="text-blue-600 hover:underline">Browse the marketplace</Link></p>
        ) : (
          <div className="space-y-3">
            {orders.map(o => (
              <div key={o._id} className="bg-white rounded-lg shadow-sm p-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</p>
                  <span className={`text-xs px-2 py-1 rounded-full capitalize ${STATUS_COLORS[o.status]}`}>{o.status}</span>
                </div>
                <ul className="text-sm text-gray-700 mb-2">
                  {o.items.map((i, idx) => (
                    <li key={idx}>{i.quantity}x {i.name} - ${(i.price * i.quantity).toFixed(2)}</li>
                  ))}
                </ul>
                <p className="font-bold text-gray-900">Total: ${o.totalAmount.toFixed(2)}</p>
                <p className="text-xs text-gray-500 capitalize">Payment: {o.paymentMethod}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
