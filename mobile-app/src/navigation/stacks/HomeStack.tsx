import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import HomeScreen from '../../screens/HomeScreen';
import NetworkScreen from '../../screens/NetworkScreen';
import LearnScreen from '../../screens/LearnScreen';
import CreateLessonScreen from '../../screens/CreateLessonScreen';
import NewsScreen from '../../screens/NewsScreen';
import CreateNewsScreen from '../../screens/CreateNewsScreen';
import MarketplaceScreen from '../../screens/MarketplaceScreen';
import CartScreen from '../../screens/CartScreen';
import OrdersScreen from '../../screens/OrdersScreen';
import CalendarScreen from '../../screens/CalendarScreen';
import { navScreenOptions } from '../screenOptions';

const Stack = createNativeStackNavigator();

export default function HomeStack() {
  return (
    <Stack.Navigator id={undefined} screenOptions={navScreenOptions}>
      <Stack.Screen name="HomeMain" component={HomeScreen} options={{ title: 'CricRoots' }} />
      <Stack.Screen name="Network" component={NetworkScreen} />
      <Stack.Screen name="Learn" component={LearnScreen} />
      <Stack.Screen name="CreateLesson" component={CreateLessonScreen} options={{ title: 'New Lesson' }} />
      <Stack.Screen name="News" component={NewsScreen} />
      <Stack.Screen name="CreateNews" component={CreateNewsScreen} options={{ title: 'New Post' }} />
      <Stack.Screen name="Marketplace" component={MarketplaceScreen} />
      <Stack.Screen name="Cart" component={CartScreen} />
      <Stack.Screen name="Orders" component={OrdersScreen} />
      <Stack.Screen name="Calendar" component={CalendarScreen} options={{ title: 'Calendar' }} />
    </Stack.Navigator>
  );
}
