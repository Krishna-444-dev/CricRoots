'use client';

import CartList from '@/components/cart/CartList';
import CartSummary from '@/components/cart/CartSummary';

export default function CartPage() {
  return (
    <main className="py-8 px-4 pb-24 sm:pb-8">
      <div className="max-w-3xl mx-auto grid grid-cols-1 sm:grid-cols-3 gap-6">
        <div className="sm:col-span-2">
          <h1 className="text-2xl font-bold text-ink mb-4">Your Cart</h1>
          <CartList />
        </div>
        <div>
          <CartSummary />
        </div>
      </div>
    </main>
  );
}
