'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/AuthContext';
import { useCart } from '@/CartContext';
import { apiFetch } from '@/lib/apiFetch';

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

  if (!isLoading && !user) {
    router.push('/login');
    return null;
  }

  if (items.length === 0) {
    return (
      <main className="min-h-screen flex items-center justify-center p-8 text-center">
        <div>
          <p className="text-gray-600 mb-4">Your cart is empty.</p>
          <Link href="/marketplace" className="text-blue-600 hover:underline">Browse the marketplace</Link>
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
    <main className="min-h-screen flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-white rounded-lg shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Checkout</h1>
        <p className="text-sm text-gray-500 mb-6">
          There's no online payment processing yet - you'll pay the seller directly using the method
          you choose below, and they'll confirm receipt on their end once payment is settled.
        </p>

        {error && <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-md text-sm">{error}</div>}

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Payment method</label>
          <div className="space-y-2">
            {PAYMENT_METHODS.map(m => (
              <label key={m.value} className="flex items-center p-3 border rounded-md cursor-pointer hover:bg-gray-50">
                <input
                  type="radio" name="paymentMethod" value={m.value}
                  checked={paymentMethod === m.value}
                  onChange={() => setPaymentMethod(m.value)}
                  className="mr-3"
                />
                {m.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex justify-between text-lg font-bold text-gray-900 mb-6 border-t pt-4">
          <span>Total</span>
          <span>${total.toFixed(2)}</span>
        </div>

        <button
          onClick={handlePlaceOrder}
          disabled={isSubmitting}
          className="w-full bg-blue-600 text-white py-3 rounded-md hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {isSubmitting ? 'Placing order...' : 'Place Order'}
        </button>
      </div>
    </main>
  );
}
