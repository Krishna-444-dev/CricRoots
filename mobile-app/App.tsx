import React from 'react';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';

import AppNavigator from './src/navigation/AppNavigator';
import { CricRootsTheme } from './src/theme';
import { AuthProvider } from './src/contexts/AuthContext';
import { CartProvider } from './src/contexts/CartContext';

export default function App() {
  return (
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
  );
}
