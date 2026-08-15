// shared/hooks/useAuth.ts
// Shared authentication hook, storage-injected so web and mobile can each provide their own
// persistence (localStorage vs SecureStore) while sharing this logic.

import { useState, useEffect, useCallback } from 'react';
import { api, setAuthToken } from '../api/apiClient';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: string;
  // Both optional: /auth/login and /auth/register now return them (see authController.js), but
  // older cached auth state (or a backend response shape change) shouldn't crash a consumer that
  // reads them - callers should treat a missing notificationPreferences as the schema default
  // (both true), same fallback notificationService.js's deliverNotifications uses server-side.
  pushToken?: string | null;
  notificationPreferences?: { push: boolean; email: boolean };
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

interface UseAuthReturn extends AuthState {
  login: (email: string, password: string) => Promise<boolean>;
  register: (name: string, email: string, password: string, role?: string) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
}

const TOKEN_STORAGE_KEY = 'cricroots_auth_token';

interface StorageInterface {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

// Normalizes the two shapes the backend returns a user in: {id,...} from
// register/login, vs {_id,...} from a raw Mongoose doc (GET /auth/me).
function normalizeUser(raw: any): AuthUser {
  return {
    id: raw.id || raw._id,
    name: raw.name,
    email: raw.email,
    role: raw.role,
    pushToken: raw.pushToken ?? null,
    notificationPreferences: raw.notificationPreferences ?? { push: true, email: true },
  };
}

export function createUseAuth(storage: StorageInterface): () => UseAuthReturn {
  return function useAuth(): UseAuthReturn {
    const [state, setState] = useState<AuthState>({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: true,
      error: null,
    });

    useEffect(() => {
      const initializeAuth = async () => {
        try {
          const storedToken = await storage.getItem(TOKEN_STORAGE_KEY);
          if (!storedToken) {
            setState(prev => ({ ...prev, isLoading: false }));
            return;
          }

          setAuthToken(storedToken);
          const { user } = await api.auth.getCurrentUser();
          setState({
            user: normalizeUser(user),
            token: storedToken,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
        } catch (error) {
          console.error('Failed to initialize auth:', error);
          setAuthToken(null);
          await storage.removeItem(TOKEN_STORAGE_KEY);
          setState({
            user: null,
            token: null,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          });
        }
      };

      initializeAuth();
    }, []);

    const login = useCallback(async (email: string, password: string): Promise<boolean> => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const { token, user } = await api.auth.login(email, password);
        setAuthToken(token);
        await storage.setItem(TOKEN_STORAGE_KEY, token);
        setState({ user: normalizeUser(user), token, isAuthenticated: true, isLoading: false, error: null });
        return true;
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Login failed. Please try again.',
        }));
        return false;
      }
    }, []);

    const register = useCallback(async (name: string, email: string, password: string, role = 'player'): Promise<boolean> => {
      setState(prev => ({ ...prev, isLoading: true, error: null }));
      try {
        const { token, user } = await api.auth.register(name, email, password, role);
        setAuthToken(token);
        await storage.setItem(TOKEN_STORAGE_KEY, token);
        setState({ user: normalizeUser(user), token, isAuthenticated: true, isLoading: false, error: null });
        return true;
      } catch (error) {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Registration failed. Please try again.',
        }));
        return false;
      }
    }, []);

    // No /auth/logout endpoint exists on the backend - logging out is purely local:
    // clear the token from memory and storage.
    const logout = useCallback(async () => {
      setAuthToken(null);
      await storage.removeItem(TOKEN_STORAGE_KEY);
      setState({ user: null, token: null, isAuthenticated: false, isLoading: false, error: null });
    }, []);

    const clearError = useCallback(() => {
      setState(prev => ({ ...prev, error: null }));
    }, []);

    return { ...state, login, register, logout, clearError };
  };
}
