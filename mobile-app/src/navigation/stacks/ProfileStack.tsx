import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../../screens/ProfileScreen';
import PlayerStatsScreen from '../../screens/PlayerStatsScreen';
import LeaderboardScreen from '../../screens/LeaderboardScreen';
import MessagesScreen from '../../screens/MessagesScreen';
import MessageThreadScreen from '../../screens/MessageThreadScreen';
import { navScreenOptions } from '../screenOptions';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  PlayerStats: { playerId: string };
  Leaderboard: undefined;
  Messages: undefined;
  MessageThread: { userId: string; name: string };
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator id={undefined} screenOptions={navScreenOptions}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="PlayerStats" component={PlayerStatsScreen} options={{ title: 'My Stats' }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
      <Stack.Screen name="MessageThread" component={MessageThreadScreen} options={{ title: 'Message' }} />
    </Stack.Navigator>
  );
}
