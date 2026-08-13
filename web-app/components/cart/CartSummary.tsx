'use client';

import React, { useState } from 'react';
import { useCart } from '@/CartContext';

export const CartSummary: React.FC = () => {
  const { items, subtotal, tax, shipping, total } = useCart();
  const [couponCode, setCouponCode] = useState('');
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [isDetailsExpanded, setIsDetailsExpanded] = useState(false);

  const handleCouponChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCouponCode(e.target.value);
    if (couponError) setCouponError('');
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) {
      setCouponError('Please enter a coupon code');
      return;
    }

    setIsApplyingCoupon(true);

    // Simulate coupon application
    setTimeout(() => {
      setCouponError('Invalid or expired coupon code');
      setIsApplyingCoupon(false);
      // In a real implementation, this would validate the coupon with the server
    }, 1000);
  };

  return (
    <div className="bg-surface border border-border p-4 sm:p-6 rounded-xl">
      <h2 className="text-lg font-semibold text-ink mb-4">Order Summary</h2>

      {/* Mobile collapsible summary */}
      <div className="sm:hidden">
        <button
          onClick={() => setIsDetailsExpanded(!isDetailsExpanded)}
          className="flex justify-between items-center w-full py-2 text-left focus:outline-none touch-manipulation"
          aria-expanded={isDetailsExpanded}
        >
          <span className="text-base font-medium text-ink">
            {isDetailsExpanded ? 'Hide details' : 'Show details'}
          </span>
          <svg
            className={`w-5 h-5 text-ink-secondary transition-transform ${isDetailsExpanded ? 'transform rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>

      {/* Order details - always visible on desktop, collapsible on mobile */}
      <div className={`space-y-3 mb-6 ${!isDetailsExpanded ? 'hidden sm:block' : ''}`}>
        <div className="flex justify-between text-sm">
          <span className="text-ink-secondary">Subtotal ({items.length} items)</span>
          <span className="font-medium text-ink">${subtotal.toFixed(2)}</span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-ink-secondary">Shipping</span>
          <span className="font-medium text-ink">
            {shipping === 0 ? 'Free' : `$${shipping.toFixed(2)}`}
          </span>
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-ink-secondary">Tax (10%)</span>
          <span className="font-medium text-ink">${tax.toFixed(2)}</span>
        </div>
      </div>

      {/* Coupon code input */}
      <div className={`mb-6 ${!isDetailsExpanded ? 'hidden sm:block' : ''}`}>
        <label htmlFor="couponCode" className="block text-sm font-medium text-ink-secondary mb-1.5">
          Promo Code
        </label>
        <div className="flex">
          <input
            type="text"
            id="couponCode"
            value={couponCode}
            onChange={handleCouponChange}
            placeholder="Enter code"
            className={`flex-1 min-w-0 px-3 py-2 bg-surface-alt border ${couponError ? 'border-wicket-500' : 'border-border-strong'} rounded-l-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-pitch-500/50 text-base`}
          />
          <button
            onClick={handleApplyCoupon}
            disabled={isApplyingCoupon}
            className="bg-surface-alt text-ink border border-l-0 border-border-strong px-4 py-2 rounded-r-lg hover:bg-surface-hover transition touch-manipulation"
          >
            {isApplyingCoupon ? 'Applying...' : 'Apply'}
          </button>
        </div>
        {couponError && (
          <p className="mt-1 text-sm text-wicket-400">{couponError}</p>
        )}
      </div>

      {/* Total - always visible */}
      <div className="border-t border-border pt-4 flex justify-between">
        <span className="text-base font-medium text-ink">Total</span>
        <span className="text-base font-bold text-pitch-400">${total.toFixed(2)}</span>
      </div>

      {/* Action buttons */}
      <div className="mt-6">
        <a
          href="/checkout/payment"
          className="w-full bg-pitch-500 text-[#06170D] font-semibold text-center py-3 px-4 rounded-lg hover:bg-pitch-400 transition flex items-center justify-center touch-manipulation"
        >
          Proceed to Checkout
        </a>

        <a
          href="/marketplace"
          className="w-full text-pitch-400 text-center py-3 px-4 mt-2 rounded-lg hover:bg-surface-hover transition flex items-center justify-center touch-manipulation"
        >
          Continue Shopping
        </a>
      </div>

      {/* Info text - collapsible on mobile */}
      <div className={`mt-6 text-xs text-ink-muted ${!isDetailsExpanded ? 'hidden sm:block' : ''}`}>
        <p>Shipping is free for orders over $100.</p>
        <p className="mt-1">Taxes are calculated based on US rates.</p>
      </div>

      {/* Fixed checkout bar for mobile */}
      <div className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border p-4 sm:hidden z-10">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-ink">Total:</span>
          <span className="text-lg font-bold text-ink">${total.toFixed(2)}</span>
        </div>
        <a
          href="/checkout/payment"
          className="w-full bg-pitch-500 text-[#06170D] font-semibold text-center py-3 px-4 rounded-lg hover:bg-pitch-400 transition flex items-center justify-center touch-manipulation"
        >
          Checkout
        </a>
      </div>
    </div>
  );
};

export default CartSummary;
