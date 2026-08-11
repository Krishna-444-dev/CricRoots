'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';
import { buttonVariants } from '@/components/ui/buttonStyles';

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
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <div><Link href="/login" className="text-pitch-400 hover:underline">Log in</Link> to see incoming orders.</div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader title="Incoming Orders" action={<Link href="/orders" className="text-sm text-pitch-400 hover:underline">&larr; Your orders</Link>} />

      {loading ? (
        <p className="text-ink-secondary">Loading...</p>
      ) : orders.length === 0 ? (
        <EmptyState icon="📥" title="No orders for your listings yet" />
      ) : (
        <div className="space-y-3">
          {orders.map(o => {
            const next = NEXT_STATUS[o.status];
            const myItems = o.items.filter(i => i.seller === user?.id);
            return (
              <Card key={o._id}>
                <div className="flex justify-between items-start mb-2">
                  <p className="text-sm text-ink-secondary">Buyer: {o.buyer?.name}</p>
                  <Badge variant="neutral" className="capitalize">{o.status}</Badge>
                </div>
                <ul className="text-sm text-ink-secondary mb-3">
                  {myItems.map((i, idx) => (
                    <li key={idx}>{i.quantity}x {i.name} — ${(i.price * i.quantity).toFixed(2)}</li>
                  ))}
                </ul>
                <p className="text-xs text-ink-muted capitalize mb-3">Payment method: {o.paymentMethod}</p>
                {next && (
                  <button
                    onClick={() => advanceStatus(o)}
                    disabled={busyId === o._id}
                    className={`${buttonVariants('primary', 'sm')} capitalize`}
                  >
                    Mark as {next}
                  </button>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </main>
  );
}
