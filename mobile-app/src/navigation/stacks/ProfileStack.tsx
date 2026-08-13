import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ProfileScreen from '../../screens/ProfileScreen';
import CompleteProfileScreen, { CompleteProfileParams } from '../../screens/CompleteProfileScreen';
import PlayerStatsScreen from '../../screens/PlayerStatsScreen';
import LeaderboardScreen from '../../screens/LeaderboardScreen';
import MessagesScreen from '../../screens/MessagesScreen';
import NewMessageScreen from '../../screens/NewMessageScreen';
import MessageThreadScreen from '../../screens/MessageThreadScreen';
import GroupsScreen from '../../screens/GroupsScreen';
import CreateGroupScreen from '../../screens/CreateGroupScreen';
import GroupDetailScreen from '../../screens/GroupDetailScreen';
import AssistantScreen from '../../screens/AssistantScreen';
import { navScreenOptions } from '../screenOptions';

export type ProfileStackParamList = {
  ProfileMain: undefined;
  CompleteProfile: CompleteProfileParams | undefined;
  PlayerStats: { playerId: string };
  Leaderboard: undefined;
  Messages: undefined;
  NewMessage: undefined;
  MessageThread: { userId: string; name: string };
  Groups: undefined;
  CreateGroup: undefined;
  GroupDetail: { groupId: string; name?: string };
  Assistant: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export default function ProfileStack() {
  return (
    <Stack.Navigator id={undefined} screenOptions={navScreenOptions}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'Profile' }} />
      <Stack.Screen name="CompleteProfile" component={CompleteProfileScreen} options={{ title: 'Player Profile' }} />
      <Stack.Screen name="PlayerStats" component={PlayerStatsScreen} options={{ title: 'My Stats' }} />
      <Stack.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
      <Stack.Screen name="Messages" component={MessagesScreen} options={{ title: 'Messages' }} />
      <Stack.Screen name="NewMessage" component={NewMessageScreen} options={{ title: 'New Message' }} />
      <Stack.Screen name="MessageThread" component={MessageThreadScreen} options={{ title: 'Message' }} />
      <Stack.Screen name="Groups" component={GroupsScreen} options={{ title: 'Groups' }} />
      <Stack.Screen name="CreateGroup" component={CreateGroupScreen} options={{ title: 'New Group' }} />
      <Stack.Screen name="GroupDetail" component={GroupDetailScreen} options={{ title: 'Group' }} />
      <Stack.Screen name="Assistant" component={AssistantScreen} options={{ title: 'Assistant' }} />
    </Stack.Navigator>
  );
}
