// shared/contexts/CartContext.tsx
// Shared cart context for both web and mobile applications

import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { Cart, CartItem, Product } from '../types';
import { api } from '../api/apiClient';

// Initial state
const initialState: Cart = {
  items: [],
  total: 0
};

// Action types
type CartAction = 
  | { type: 'ADD_ITEM'; payload: { product: Product; quantity: number } }
  | { type: 'UPDATE_QUANTITY'; payload: { productId: string; quantity: number } }
  | { type: 'REMOVE_ITEM'; payload: { productId: string } }
  | { type: 'CLEAR_CART' }
  | { type: 'SET_CART'; payload: Cart };

// Reducer function
function cartReducer(state: Cart, action: CartAction): Cart {
  switch (action.type) {
    case 'ADD_ITEM': {
      const { product, quantity } = action.payload;
      const existingItemIndex = state.items.findIndex(item => item.productId === product.id);
      
      if (existingItemIndex >= 0) {
        // Item already exists, update quantity
        const updatedItems = [...state.items];
        updatedItems[existingItemIndex] = {
          ...updatedItems[existingItemIndex],
          quantity: updatedItems[existingItemIndex].quantity + quantity
        };
        
        return {
          items: updatedItems,
          total: calculateTotal(updatedItems)
        };
      } else {
        // Add new item
        const newItem: CartItem = {
          productId: product.id,
          name: product.name,
          price: product.price,
          quantity,
          image: product.image
        };
        
        return {
          items: [...state.items, newItem],
          total: calculateTotal([...state.items, newItem])
        };
      }
    }
    
    case 'UPDATE_QUANTITY': {
      const { productId, quantity } = action.payload;
      
      if (quantity <= 0) {
        // If quantity is 0 or negative, remove the item
        return {
          items: state.items.filter(item => item.productId !== productId),
          total: calculateTotal(state.items.filter(item => item.productId !== productId))
        };
      }
      
      const updatedItems = state.items.map(item => 
        item.productId === productId ? { ...item, quantity } : item
      );
      
      return {
        items: updatedItems,
        total: calculateTotal(updatedItems)
      };
    }
    
    case 'REMOVE_ITEM': {
      const updatedItems = state.items.filter(item => item.productId !== action.payload.productId);
      
      return {
        items: updatedItems,
        total: calculateTotal(updatedItems)
      };
    }
    
    case 'CLEAR_CART':
      return initialState;
    
    case 'SET_CART':
      return action.payload;
    
    default:
      return state;
  }
}

// Helper function to calculate total
function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
}

// Context type
interface CartContextType {
  cart: Cart;
  addItem: (product: Product, quantity: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  isLoading: boolean;
  error: string | null;
}

// Create context
const CartContext = createContext<CartContextType | undefined>(undefined);

// Storage interface for platform-specific implementations
interface StorageInterface {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

// Storage key
const CART_STORAGE_KEY = 'cricsync_cart';

// Provider component factory
export function createCartProvider(storage: StorageInterface) {
  return function CartProvider({ children }: { children: React.ReactNode }) {
    const [cart, dispatch] = useReducer(cartReducer, initialState);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | null>(null);
    
    // Load cart from storage on mount
    useEffect(() => {
      const loadCart = async () => {
        try {
          const storedCart = await storage.getItem(CART_STORAGE_KEY);
          
          if (storedCart) {
            dispatch({ type: 'SET_CART', payload: JSON.parse(storedCart) });
          }
        } catch (error) {
          console.error('Failed to load cart from storage:', error);
          setError('Failed to load your shopping cart. Please try again.');
        }
      };
      
      loadCart();
    }, []);
    
    // Save cart to storage when it changes
    useEffect(() => {
      const saveCart = async () => {
        try {
          await storage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
        } catch (error) {
          console.error('Failed to save cart to storage:', error);
        }
      };
      
      saveCart();
    }, [cart]);
    
    // Add item to cart
    const addItem = async (product: Product, quantity: number) => {
      setError(null);
      
      try {
        setIsLoading(true);
        
        // In a real app, we would call the API here
        // await api.cart.addToCart(product.id, quantity);
        
        dispatch({ type: 'ADD_ITEM', payload: { product, quantity } });
      } catch (error) {
        console.error('Failed to add item to cart:', error);
        setError('Failed to add item to cart. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    // Update item quantity
    const updateQuantity = async (productId: string, quantity: number) => {
      setError(null);
      
      try {
        setIsLoading(true);
        
        // In a real app, we would call the API here
        // await api.cart.updateCartItem(productId, quantity);
        
        dispatch({ type: 'UPDATE_QUANTITY', payload: { productId, quantity } });
      } catch (error) {
        console.error('Failed to update item quantity:', error);
        setError('Failed to update item quantity. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    // Remove item from cart
    const removeItem = async (productId: string) => {
      setError(null);
      
      try {
        setIsLoading(true);
        
        // In a real app, we would call the API here
        // await api.cart.removeFromCart(productId);
        
        dispatch({ type: 'REMOVE_ITEM', payload: { productId } });
      } catch (error) {
        console.error('Failed to remove item from cart:', error);
        setError('Failed to remove item from cart. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    // Clear cart
    const clearCart = async () => {
      setError(null);
      
      try {
        setIsLoading(true);
        
        // In a real app, we would call the API here
        // await api.cart.clearCart();
        
        dispatch({ type: 'CLEAR_CART' });
      } catch (error) {
        console.error('Failed to clear cart:', error);
        setError('Failed to clear cart. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    return (
      <CartContext.Provider
        value={{
          cart,
          addItem,
          updateQuantity,
          removeItem,
          clearCart,
          isLoading,
          error
        }}
      >
        {children}
      </CartContext.Provider>
    );
  };
}

// Hook to use the cart context
export function useCart() {
  const context = useContext(CartContext);
  
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  
  return context;
}

// This will be implemented differently for web and mobile
// For web:
// import { createCartProvider, useCart } from '../shared/contexts/CartContext';
// const webStorage = {
//   getItem: async (key) => localStorage.getItem(key),
//   setItem: async (key, value) => localStorage.setItem(key, value),
//   removeItem: async (key) => localStorage.removeItem(key)
// };
// export const CartProvider = createCartProvider(webStorage);
// export { useCart };

// For mobile:
// import { createCartProvider, useCart } from '../shared/contexts/CartContext';
// import AsyncStorage from '@react-native-async-storage/async-storage';
// const mobileStorage = {
//   getItem: AsyncStorage.getItem,
//   setItem: AsyncStorage.setItem,
//   removeItem: AsyncStorage.removeItem
// };
// export const CartProvider = createCartProvider(mobileStorage);
// export { useCart };
