// Mobile-specific implementation of the shared cart context
import { createCartProvider, useCart as useSharedCart } from '../shared/contexts/CartContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mobile storage implementation using AsyncStorage
const mobileStorage = {
  getItem: AsyncStorage.getItem,
  setItem: AsyncStorage.setItem,
  removeItem: AsyncStorage.removeItem
};

// Create the mobile-specific CartProvider
export const CartProvider = createCartProvider(mobileStorage);

// Export the useCart hook
export const useCart = useSharedCart;
