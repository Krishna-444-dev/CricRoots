'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Badge, { BadgeVariant } from '@/components/ui/Badge';
import PageHeader from '@/components/ui/PageHeader';
import EmptyState from '@/components/ui/EmptyState';

interface Order {
  _id: string;
  items: { name: string; price: number; quantity: number }[];
  totalAmount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
}

const STATUS_VARIANT: Record<string, BadgeVariant> = {
  pending: 'warning',
  paid: 'info',
  shipped: 'gold',
  completed: 'success',
  cancelled: 'danger',
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
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <div><Link href="/login" className="text-pitch-400 hover:underline">Log in</Link> to see your orders.</div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-4 py-8">
      <PageHeader title="Your Orders" action={<Link href="/orders/selling" className="text-sm text-pitch-400 hover:underline">Selling &rarr;</Link>} />

      {loading ? (
        <p className="text-ink-secondary">Loading...</p>
      ) : orders.length === 0 ? (
        <EmptyState icon="📦" title="No orders yet" action={<Link href="/marketplace" className="text-pitch-400 hover:underline text-sm">Browse the marketplace</Link>} />
      ) : (
        <div className="space-y-3">
          {orders.map(o => (
            <Card key={o._id}>
              <div className="flex justify-between items-start mb-2">
                <p className="text-sm text-ink-muted">{new Date(o.createdAt).toLocaleDateString()}</p>
                <Badge variant={STATUS_VARIANT[o.status] ?? 'neutral'} className="capitalize">{o.status}</Badge>
              </div>
              <ul className="text-sm text-ink-secondary mb-2">
                {o.items.map((i, idx) => (
                  <li key={idx}>{i.quantity}x {i.name} — ${(i.price * i.quantity).toFixed(2)}</li>
                ))}
              </ul>
              <p className="font-bold text-ink">Total: ${o.totalAmount.toFixed(2)}</p>
              <p className="text-xs text-ink-muted capitalize">Payment: {o.paymentMethod}</p>
            </Card>
          ))}
        </div>
      )}
    </main>
  );
}
