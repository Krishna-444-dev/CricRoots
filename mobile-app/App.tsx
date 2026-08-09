import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Provider as PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';

// Import screens
import HomeScreen from './src/screens/HomeScreen';
import TeamsScreen from './src/screens/TeamsScreen';
import ScoringScreen from './src/screens/ScoringScreen';
import ShopScreen from './src/screens/ShopScreen';
import ProfileScreen from './src/screens/ProfileScreen';

// Import theme
import { CricSyncTheme, colors } from './src/theme';

// Import contexts
import { CartProvider } from './src/contexts/CartContext';

const Tab = createBottomTabNavigator();

export default function App() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={CricSyncTheme}>
        <CartProvider>
          <NavigationContainer>
            <Tab.Navigator
              screenOptions={({ route }) => ({
                tabBarIcon: ({ focused, color, size }) => {
                  let iconName;

                  if (route.name === 'Home') {
                    iconName = focused ? 'home' : 'home-outline';
                  } else if (route.name === 'Teams') {
                    iconName = focused ? 'people' : 'people-outline';
                  } else if (route.name === 'Scoring') {
                    iconName = focused ? 'stats-chart' : 'stats-chart-outline';
                  } else if (route.name === 'Shop') {
                    iconName = focused ? 'cart' : 'cart-outline';
                  } else if (route.name === 'Profile') {
                    iconName = focused ? 'person' : 'person-outline';
                  }

                  return <Ionicons name={iconName} size={size} color={color} />;
                },
                tabBarActiveTintColor: colors.primary,
                tabBarInactiveTintColor: colors.textSecondary,
                headerShown: true,
                headerStyle: {
                  backgroundColor: colors.primary,
                },
                headerTintColor: 'white',
                headerTitleStyle: {
                  fontWeight: 'bold',
                },
              })}
            >
              <Tab.Screen 
                name="Home" 
                component={HomeScreen} 
                options={{ title: 'CricSync' }}
              />
              <Tab.Screen name="Teams" component={TeamsScreen} />
              <Tab.Screen name="Scoring" component={ScoringScreen} />
              <Tab.Screen name="Shop" component={ShopScreen} />
              <Tab.Screen name="Profile" component={ProfileScreen} />
            </Tab.Navigator>
          </NavigationContainer>
          <StatusBar style="auto" />
        </CartProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
});
