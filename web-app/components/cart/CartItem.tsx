'use client';

import React, { useState } from 'react';
import { useCart, CartItem as CartItemType } from '@/CartContext';

interface CartItemProps {
  item: CartItemType;
}

export const CartItem: React.FC<CartItemProps> = ({ item }) => {
  const { updateQuantity, removeItem } = useCart();
  const [isSwipeActive, setIsSwipeActive] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const handleQuantityChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newQuantity = parseInt(e.target.value, 10);
    updateQuantity(item.id, newQuantity);
  };

  // Quantity increment/decrement handlers for touch-friendly controls
  const incrementQuantity = () => {
    if (item.quantity < 10) {
      updateQuantity(item.id, item.quantity + 1);
    }
  };

  const decrementQuantity = () => {
    if (item.quantity > 1) {
      updateQuantity(item.id, item.quantity - 1);
    }
  };

  // Touch event handlers for swipe-to-delete functionality
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.targetTouches[0].clientX);
    setTouchEnd(null);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
    
    // If swiped left more than 50px, show delete button
    if (touchStart && touchEnd && touchStart - touchEnd > 50) {
      setIsSwipeActive(true);
    } else {
      setIsSwipeActive(false);
    }
  };

  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    // Reset touch states
    setTouchStart(null);
    setTouchEnd(null);
  };

  return (
    <div 
      className="relative overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Main cart item content */}
      <div 
        className={`flex flex-col sm:flex-row items-start sm:items-center py-4 border-b border-gray-200 bg-white transition-transform duration-300 ${
          isSwipeActive ? 'transform -translate-x-20' : ''
        }`}
      >
        <div className="w-full sm:w-auto flex items-center">
          <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-md overflow-hidden">
            {item.image ? (
              <img 
                src={item.image} 
                alt={item.name} 
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-400">
                No image
              </div>
            )}
          </div>
          
          <div className="ml-4 flex-1">
            <h3 className="text-base font-medium text-gray-800">{item.name}</h3>
            <p className="mt-1 text-sm text-gray-600">${item.price.toFixed(2)}</p>
            <p className="mt-1 text-xs text-gray-500 sm:hidden">
              Subtotal: ${(item.price * item.quantity).toFixed(2)}
            </p>
          </div>
        </div>
        
        {/* Touch-friendly quantity controls */}
        <div className="flex items-center mt-4 sm:mt-0 sm:ml-auto">
          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
            <button 
              onClick={decrementQuantity}
              className="px-3 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 touch-manipulation"
              aria-label="Decrease quantity"
              disabled={item.quantity <= 1}
            >
              -
            </button>
            
            <span className="px-3 py-2 text-center min-w-[40px]">
              {item.quantity}
            </span>
            
            <button 
              onClick={incrementQuantity}
              className="px-3 py-2 bg-gray-100 text-gray-600 hover:bg-gray-200 touch-manipulation"
              aria-label="Increase quantity"
              disabled={item.quantity >= 10}
            >
              +
            </button>
          </div>
          
          {/* Desktop select dropdown (hidden on mobile) */}
          <select 
            value={item.quantity} 
            onChange={handleQuantityChange}
            className="hidden sm:block ml-4 p-2 border border-gray-300 rounded-md"
            aria-label={`Quantity for ${item.name}`}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(num => (
              <option key={num} value={num}>
                {num}
              </option>
            ))}
          </select>
          
          {/* Subtotal (visible only on larger screens) */}
          <div className="hidden sm:block ml-4 min-w-[80px] text-right">
            <span className="font-medium">${(item.price * item.quantity).toFixed(2)}</span>
          </div>
          
          {/* Remove button (visible only on larger screens) */}
          <button 
            onClick={() => removeItem(item.id)}
            className="hidden sm:block ml-4 text-sm text-red-600 hover:text-red-800 touch-manipulation"
            aria-label={`Remove ${item.name} from cart`}
          >
            Remove
          </button>
        </div>
      </div>
      
      {/* Swipe-to-delete button (visible on mobile when swiped) */}
      <button 
        onClick={() => removeItem(item.id)}
        className="absolute right-0 top-0 bottom-0 w-20 bg-red-600 text-white flex items-center justify-center touch-manipulation"
        aria-label={`Remove ${item.name} from cart`}
      >
        Remove
      </button>
    </div>
  );
};

export default CartItem;
