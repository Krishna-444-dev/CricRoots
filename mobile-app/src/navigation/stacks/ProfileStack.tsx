import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../../screens/ProfileScreen';
import PlayerStatsScreen from '../../screens/PlayerStatsScreen';
import { navScreenOptions } from '../screenOptions';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  PlayerStats: { playerId: string };
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={navScreenOptions}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="PlayerStats" component={PlayerStatsScreen} options={{ title: 'My Stats' }} />
    </Stack.Navigator>
  );
}
