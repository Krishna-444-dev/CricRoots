'use client';

import React, { useRef, useEffect, useState } from 'react';
import { useCart } from '@/CartContext';
import CartItem from './CartItem';

export const CartList: React.FC = () => {
  const { items } = useCart();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [pullStartY, setPullStartY] = useState(0);
  const [pullMoveY, setPullMoveY] = useState(0);
  const listRef = useRef<HTMLDivElement>(null);

  // Handle pull-to-refresh functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    // Only enable pull-to-refresh when at the top of the list
    if (listRef.current && listRef.current.scrollTop === 0) {
      setPullStartY(e.touches[0].clientY);
    } else {
      setPullStartY(0);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (pullStartY > 0) {
      setPullMoveY(e.touches[0].clientY);
    }
  };

  const handleTouchEnd = () => {
    // If pulled down more than 100px, trigger refresh
    if (pullStartY > 0 && pullMoveY > 0 && pullMoveY - pullStartY > 100) {
      refreshCart();
    }
    
    // Reset pull values
    setPullStartY(0);
    setPullMoveY(0);
  };

  const refreshCart = () => {
    setIsRefreshing(true);
    
    // Simulate refresh with timeout
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
    
    // In a real implementation, this would refresh cart data from the server
  };

  // Calculate pull distance for refresh indicator
  const pullDistance = pullStartY && pullMoveY ? Math.min(pullMoveY - pullStartY, 150) : 0;

  if (items.length === 0) {
    return (
      <div className="py-8 px-4 text-center">
        <div className="max-w-md mx-auto">
          <svg 
            className="w-16 h-16 mx-auto text-gray-400" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={1.5} 
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" 
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-700 mb-2">Your cart is empty</h3>
          <p className="text-gray-500">Add items to your cart to see them here.</p>
          <div className="mt-6">
            <a 
              href="/marketplace" 
              className="inline-block bg-blue-600 text-white py-3 px-6 rounded-md hover:bg-blue-700 transition touch-manipulation w-full sm:w-auto"
            >
              Continue Shopping
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div 
      className="relative h-full overflow-auto -mx-4 px-4"
      ref={listRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull-to-refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="absolute top-0 left-0 right-0 flex justify-center items-center transition-transform"
          style={{ 
            height: `${pullDistance}px`,
            transform: `translateY(${pullDistance > 50 ? '0' : '-100%'})` 
          }}
        >
          <div className="flex items-center space-x-2 text-gray-500">
            <svg 
              className={`w-5 h-5 ${pullDistance > 100 ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            <span className="text-sm">
              {pullDistance > 100 ? 'Release to refresh' : 'Pull to refresh'}
            </span>
          </div>
        </div>
      )}
      
      {/* Refreshing indicator */}
      {isRefreshing && (
        <div className="absolute top-0 left-0 right-0 flex justify-center items-center py-4 bg-white z-10">
          <div className="flex items-center space-x-2 text-gray-500">
            <svg 
              className="w-5 h-5 animate-spin" 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            <span className="text-sm">Refreshing cart...</span>
          </div>
        </div>
      )}
      
      {/* Cart items list with sticky header */}
      <div className="pb-20 sm:pb-0"> {/* Extra padding at bottom for mobile to account for fixed checkout bar */}
        <div className="sticky top-0 bg-white z-10 py-3 border-b border-gray-200 hidden sm:flex">
          <div className="flex-1">Product</div>
          <div className="w-32 text-center">Quantity</div>
          <div className="w-24 text-right">Subtotal</div>
          <div className="w-20 text-right">Action</div>
        </div>
        
        <div className="divide-y divide-gray-200">
          {items.map(item => (
            <CartItem key={item.id} item={item} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default CartList;
