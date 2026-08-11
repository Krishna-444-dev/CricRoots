'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';

interface Order {
  _id: string;
  buyer: { name: string };
  items: { name: string; price: number; quantity: number; seller: string }[];
  totalAmount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
}

const NEXT_STATUS: Record<string, string | null> = {
  pending: 'paid',
  paid: 'shipped',
  shipped: 'completed',
  completed: null,
  cancelled: null,
};

export default function SellingOrdersPage() {
  const { user, isLoading } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    apiFetch('/api/orders/selling')
      .then(r => r.json())
      .then(data => { if (data.success) setOrders(data.orders); })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { if (user) load(); }, [user, load]);

  const advanceStatus = async (order: Order) => {
    const next = NEXT_STATUS[order.status];
    if (!next || busyId) return;
    setBusyId(order._id);
    try {
      const res = await apiFetch(`/api/orders/${order._id}/status`, {
        method: 'PUT',
        body: JSON.stringify({ status: next }),
      });
      const data = await res.json();
      if (data.success) load();
    } finally {
      setBusyId(null);
    }
  };

  if (!isLoading && !user) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 text-center">
        <div><Link href="/login" className="text-blue-600 hover:underline">Log in</Link> to see incoming orders.</div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Incoming Orders</h1>
          <Link href="/orders" className="text-sm text-blue-600 hover:underline">&larr; Your orders</Link>
        </div>

        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : orders.length === 0 ? (
          <p className="text-gray-500">No orders for your listings yet.</p>
        ) : (
          <div className="space-y-3">
            {orders.map(o => {
              const next = NEXT_STATUS[o.status];
              const myItems = o.items.filter(i => i.seller === user?.id);
              return (
                <div key={o._id} className="bg-white rounded-lg shadow-sm p-4">
                  <div className="flex justify-between items-start mb-2">
                    <p className="text-sm text-gray-700">Buyer: {o.buyer?.name}</p>
                    <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">{o.status}</span>
                  </div>
                  <ul className="text-sm text-gray-700 mb-3">
                    {myItems.map((i, idx) => (
                      <li key={idx}>{i.quantity}x {i.name} - ${(i.price * i.quantity).toFixed(2)}</li>
                    ))}
                  </ul>
                  <p className="text-xs text-gray-500 capitalize mb-3">Payment method: {o.paymentMethod}</p>
                  {next && (
                    <button
                      onClick={() => advanceStatus(o)}
                      disabled={busyId === o._id}
                      className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 transition text-sm capitalize"
                    >
                      Mark as {next}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
