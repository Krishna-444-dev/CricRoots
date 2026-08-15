// Wraps the shared useAuth hook factory in a React Context so every consumer (the navigator
// deciding auth vs. main tabs, LoginScreen, ProfileScreen, etc.) reads and updates the SAME
// state instance. Without this, each component calling the hook factory directly would get
// its own independent auth state, and a successful login in LoginScreen would never be seen
// by the navigator deciding which stack to show.
import React, { createContext, useContext, useEffect, useRef } from 'react';
import * as SecureStore from 'expo-secure-store';
import { createUseAuth } from '../shared/hooks/useAuth';
import { registerForPushNotificationsAsync } from '../shared/utils/pushNotifications';

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

  // Registers this device's Expo push token once per authenticated session - fires the same way
  // whether auth just completed (fresh login/register) or was restored from SecureStore on cold
  // start (the closest thing this app has to "logged in, now fetch initial data"; there's no
  // separate foreground-resume hook to hang this off elsewhere). Guarded by a ref, not by putting
  // user.id in the dependency array, so it registers once per app session rather than re-firing
  // on every background refetch that happens to change the user object's identity.
  const hasRegisteredPush = useRef(false);
  useEffect(() => {
    if (auth.isAuthenticated && !hasRegisteredPush.current) {
      hasRegisteredPush.current = true;
      registerForPushNotificationsAsync();
    }
    if (!auth.isAuthenticated) {
      hasRegisteredPush.current = false;
    }
  }, [auth.isAuthenticated]);

  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
