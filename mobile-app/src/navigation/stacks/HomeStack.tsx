import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../../screens/HomeScreen';
import NetworkScreen from '../../screens/NetworkScreen';
import LearnScreen from '../../screens/LearnScreen';
import NewsScreen from '../../screens/NewsScreen';
import MarketplaceScreen from '../../screens/MarketplaceScreen';
import CartScreen from '../../screens/CartScreen';
import OrdersScreen from '../../screens/OrdersScreen';
import { navScreenOptions } from '../screenOptions';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator screenOptions={navScreenOptions}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ title: 'CricSync' }} />
      <Stack.Screen name="Network" component={NetworkScreen} />
      <Stack.Screen name="Learn" component={LearnScreen} />
      <Stack.Screen name="News" component={NewsScreen} />
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Orders" component={OrdersScreen} />
    </Stack.Navigator>
  );
}
