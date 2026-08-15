import React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import AppNavigator from './src/navigation/AppNavigator';
import { CricRootsTheme } from './src/theme';
import { AuthProvider } from './src/contexts/AuthContext';
import { CartProvider } from './src/contexts/CartContext';
import { ErrorBoundary } from './src/components/ErrorBoundary';

export default function App() {
  return (
    // Outermost, above every provider - a crash anywhere below (including in the providers
    // themselves) still gets a visible fallback instead of an unhandled-error blank screen.
    <ErrorBoundary>
      <SafeAreaProvider>
        <PaperProvider theme={CricRootsTheme}>
          <AuthProvider>
            <CartProvider>
              <AppNavigator />
              <StatusBar style="light" />
            </CartProvider>
          </AuthProvider>
        </PaperProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}
