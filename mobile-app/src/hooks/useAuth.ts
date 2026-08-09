// Mobile-specific implementation of the shared auth hook
import { createUseAuth } from '../shared/hooks/useAuth';
import * as SecureStore from 'expo-secure-store';

// Mobile storage implementation using Expo's SecureStore
const mobileStorage = {
  getItem: async (key: string) => SecureStore.getItemAsync(key),
  setItem: async (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: async (key: string) => SecureStore.deleteItemAsync(key)
};

// Create the mobile-specific useAuth hook
export const useAuth = createUseAuth(mobileStorage);
