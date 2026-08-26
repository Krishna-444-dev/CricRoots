import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MatchesListScreen from '../../screens/MatchesListScreen';
import CreateMatchScreen from '../../screens/CreateMatchScreen';
import MatchDetailScreen from '../../screens/MatchDetailScreen';
import LiveScoringScreen from '../../screens/LiveScoringScreen';
import PerformanceReportScreen from '../../screens/PerformanceReportScreen';
import ScoutingReportScreen from '../../screens/ScoutingReportScreen';
import PlayerStatsScreen from '../../screens/PlayerStatsScreen';
import TeamDetailScreen from '../../screens/TeamDetailScreen';
import { navScreenOptions } from '../screenOptions';

// PlayerStats and TeamDetail are registered in several stacks on purpose.
//
// Cricket has a natural navigation graph - match -> team -> player -> match -> tournament - and a
// player name in a scorecard has to open that player WITHOUT throwing the user into another tab
// and losing their place in the match. React Navigation's answer is to register the destination in
// each stack that links to it, so the push stays local and Back returns where you came from.
// Screen COMPONENTS are shared; only the route registration is duplicated.
export type MatchesStackParamList = {
  MatchesList: undefined;
  CreateMatch: undefined;
  MatchDetail: { matchId: string };
  LiveScoring: { matchId: string };
  PerformanceReport: { matchId: string; playerId: string };
  ScoutingReport: { matchId: string };
  PlayerStats: { playerId: string };
  TeamDetail: { teamId: string };
};

const Stack = createNativeStackNavigator<MatchesStackParamList>();

export default function MatchesStack() {
  return (
    <Stack.Navigator id={undefined} screenOptions={navScreenOptions}>
      <Stack.Screen name="MatchesList" component={MatchesListScreen} options={{ title: 'Matches' }} />
      <Stack.Screen name="CreateMatch" component={CreateMatchScreen} options={{ title: 'New Match' }} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} options={{ title: 'Match' }} />
      <Stack.Screen name="LiveScoring" component={LiveScoringScreen} options={{ title: 'Live Scoring' }} />
      <Stack.Screen name="PerformanceReport" component={PerformanceReportScreen} options={{ title: 'Performance Report' }} />
      <Stack.Screen name="ScoutingReport" component={ScoutingReportScreen} options={{ title: 'Scouting Report' }} />
      <Stack.Screen name="PlayerStats" component={PlayerStatsScreen} options={{ title: 'Player' }} />
      <Stack.Screen name="TeamDetail" component={TeamDetailScreen} options={{ title: 'Team' }} />
    </Stack.Navigator>
  );
}
