// shared/hooks/useAuth.ts
// Shared authentication hook for both web and mobile applications

import { useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../api/apiClient';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (userData: Partial<User>, password: string) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
}

// Storage key for auth token - implementation will differ between web and mobile
const TOKEN_STORAGE_KEY = 'cricsync_auth_token';

// Platform-specific storage implementation will be injected
interface StorageInterface {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

export function createUseAuth(storage: StorageInterface): () => UseAuthReturn {
  return function useAuth(): UseAuthReturn {
    const [state, setState] = useState<AuthState>({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      error: null
    });

    // Initialize auth state from storage
    useEffect(() => {
      const initializeAuth = async () => {
        try {
          const storedToken = await storage.getItem(TOKEN_STORAGE_KEY);
          
          if (storedToken) {
            const user = await api.auth.getCurrentUser(storedToken);
            setState({
              user,
              token: storedToken,
              isAuthenticated: true,
              isLoading: false,
              error: null
            });
          } else {
            setState(prev => ({ ...prev, isLoading: false }));
          }
        } catch (error) {
          console.error('Failed to initialize auth:', error);
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: 'Session expired. Please log in again.'
          });
          await storage.removeItem(TOKEN_STORAGE_KEY);
        }
      };

      initializeAuth();
    }, []);

    const login = async (email: string, password: string) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        const { user, token } = await api.auth.login(email, password);
        
        await storage.setItem(TOKEN_STORAGE_KEY, token);
        
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
      } catch (error) {
        console.error('Login failed:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Login failed. Please try again.'
        }));
      }
    };

    const register = async (userData: Partial<User>, password: string) => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      
      try {
        const { user, token } = await api.auth.register(userData, password);
        
        await storage.setItem(TOKEN_STORAGE_KEY, token);
        
        setState({
          user,
          token,
          isAuthenticated: true,
          isLoading: false,
          error: null
        });
      } catch (error) {
        console.error('Registration failed:', error);
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Registration failed. Please try again.'
        }));
      }
    };

    const logout = async () => {
      setState(prev => ({ ...prev, isLoading: true }));
      
      try {
        if (state.token) {
          await api.auth.logout();
        }
      } catch (error) {
        console.error('Logout API call failed:', error);
        // Continue with local logout even if API call fails
      }
      
      await storage.removeItem(TOKEN_STORAGE_KEY);
      
      setState({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        error: null
      });
    };

    const clearError = () => {
      setState(prev => ({ ...prev, error: null }));
    };

    return {
      ...state,
      login,
      register,
      logout,
      clearError
    };
  };
}

// This will be implemented differently for web and mobile
// For web:
// import { createUseAuth } from '../shared/hooks/useAuth';
// const webStorage = {
//   getItem: async (key) => localStorage.getItem(key),
//   setItem: async (key, value) => localStorage.setItem(key, value),
//   removeItem: async (key) => localStorage.removeItem(key)
// };
// export const useAuth = createUseAuth(webStorage);

// For mobile:
// import { createUseAuth } from '../shared/hooks/useAuth';
// import * as SecureStore from 'expo-secure-store';
// const mobileStorage = {
//   getItem: async (key) => SecureStore.getItemAsync(key),
//   setItem: async (key, value) => SecureStore.setItemAsync(key, value),
//   removeItem: async (key) => SecureStore.deleteItemAsync(key)
// };
// export const useAuth = createUseAuth(mobileStorage);
