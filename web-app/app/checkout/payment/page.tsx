'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { useCart } from '@/CartContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { errorBoxClass } from '@/components/ui/formStyles';

const PAYMENT_METHODS = [
  { value: 'cash', label: 'Cash on pickup/delivery' },
  { value: 'bank-transfer', label: 'Bank transfer' },
  { value: 'in-person', label: 'Arrange with seller' },
];

export default function CheckoutPaymentPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { items, total, clearCart } = useCart();
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) router.push('/login');
  }, [isLoading, user, router]);

  if (!isLoading && !user) return null;

  if (items.length === 0) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <div>
          <p className="text-ink-secondary mb-4">Your cart is empty.</p>
          <Link href="/marketplace" className="text-pitch-400 hover:underline">Browse the marketplace</Link>
        </div>
      </main>
    );
  }

  const handlePlaceOrder = async () => {
    setError(null);
    setIsSubmitting(true);
    try {
      const res = await apiFetch('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          items: items.map(i => ({ productId: i.id, quantity: i.quantity })),
          paymentMethod,
        }),
      });
      const data = await res.json();
      if (data.success) {
        clearCart();
        router.push('/orders');
      } else {
        setError(data.message || 'Could not place order');
      }
    } catch {
      setError('Could not reach the CricSync server');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex items-center justify-center px-4 py-12 min-h-[calc(100vh-4rem)]">
      <Card padding="lg" className="w-full max-w-md">
        <h1 className="text-2xl font-bold text-ink mb-2">Checkout</h1>
        <p className="text-sm text-ink-secondary mb-6">
          There&apos;s no online payment processing yet — you&apos;ll pay the seller directly using the method
          you choose below, and they&apos;ll confirm receipt on their end once payment is settled.
        </p>

        {error && <div className={`${errorBoxClass} mb-4`}>{error}</div>}

        <div className="mb-6">
          <label className="block text-sm font-medium text-ink-secondary mb-2">Payment method</label>
          <div className="space-y-2">
            {PAYMENT_METHODS.map(m => (
              <label key={m.value} className="flex items-center p-3 bg-surface-alt border border-border-strong rounded-lg cursor-pointer hover:bg-surface-hover transition-colors text-ink">
                <input
                  type="radio" name="paymentMethod" value={m.value}
                  checked={paymentMethod === m.value}
                  onChange={() => setPaymentMethod(m.value)}
                  className="mr-3 accent-pitch-500"
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-between text-lg font-bold text-ink mb-6 border-t border-border pt-4">
          <span>Total</span>
          <span className="text-pitch-400">${total.toFixed(2)}</span>
        </div>

        <Button onClick={handlePlaceOrder} disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Placing order...' : 'Place Order'}
        </Button>
      </Card>
    </main>
  );
}
