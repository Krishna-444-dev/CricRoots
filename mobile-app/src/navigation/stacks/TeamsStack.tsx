import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TeamsScreen from '../../screens/TeamsScreen';
import TeamDetailScreen from '../../screens/TeamDetailScreen';
import CreateTeamScreen from '../../screens/CreateTeamScreen';
import PlayerStatsScreen from '../../screens/PlayerStatsScreen';
import { navScreenOptions } from '../screenOptions';

// PlayerStats and TeamDetail are registered in several stacks on purpose.
//
// Cricket has a natural navigation graph - match -> team -> player -> match -> tournament - and a
// player name in a scorecard has to open that player WITHOUT throwing the user into another tab
// and losing their place in the match. React Navigation's answer is to register the destination in
// each stack that links to it, so the push stays local and Back returns where you came from.
// Screen COMPONENTS are shared; only the route registration is duplicated.
export type TeamsStackParamList = {
  TeamsList: undefined;
  TeamDetail: { teamId: string };
  CreateTeam: undefined;
  PlayerStats: { playerId: string };
};

const Stack = createNativeStackNavigator<TeamsStackParamList>();

export default function TeamsStack() {
  return (
    <Stack.Navigator id={undefined} screenOptions={navScreenOptions}>
      <Stack.Screen name="TeamsList" component={TeamsScreen} options={{ title: 'Teams' }} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} options={{ title: 'Team' }} />
      <Stack.Screen name="CreateTeam" component={CreateTeamScreen} options={{ title: 'New Team' }} />
      <Stack.Screen name="PlayerStats" component={PlayerStatsScreen} options={{ title: 'Player' }} />
    </Stack.Navigator>
  );
}
