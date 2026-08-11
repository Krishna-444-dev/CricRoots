// Wraps the shared useAuth hook factory in a React Context so every consumer (the navigator
// deciding auth vs. main tabs, LoginScreen, ProfileScreen, etc.) reads and updates the SAME
// state instance. Without this, each component calling the hook factory directly would get
// its own independent auth state, and a successful login in LoginScreen would never be seen
// by the navigator deciding which stack to show.
import React, { createContext, useContext } from 'react';
import * as SecureStore from 'expo-secure-store';
import { createUseAuth } from '../shared/hooks/useAuth';

const mobileStorage = {
  getItem: (key: string) => SecureStore.getItemAsync(key),
  setItem: (key: string, value: string) => SecureStore.setItemAsync(key, value),
  removeItem: (key: string) => SecureStore.deleteItemAsync(key),
};

const useAuthState = createUseAuth(mobileStorage);

type AuthContextValue = ReturnType<typeof useAuthState>;

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const auth = useAuthState();
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
