import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TeamsScreen from '../../screens/TeamsScreen';
import TeamDetailScreen from '../../screens/TeamDetailScreen';
import CreateTeamScreen from '../../screens/CreateTeamScreen';
import { navScreenOptions } from '../screenOptions';

export type TeamsStackParamList = {
  TeamsList: undefined;
  TeamDetail: { teamId: string };
  CreateTeam: undefined;
};

const Stack = createNativeStackNavigator<TeamsStackParamList>();

export default function TeamsStack() {
  return (
    <Stack.Navigator screenOptions={navScreenOptions}>
      <Stack.Screen name="TeamsList" component={TeamsScreen} options={{ title: 'Teams' }} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} options={{ title: 'Team' }} />
      <Stack.Screen name="CreateTeam" component={CreateTeamScreen} options={{ title: 'New Team' }} />
    </Stack.Navigator>
  );
}
