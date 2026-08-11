import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MatchesListScreen from '../../screens/MatchesListScreen';
import MatchDetailScreen from '../../screens/MatchDetailScreen';
import LiveScoringScreen from '../../screens/LiveScoringScreen';
import { navScreenOptions } from '../screenOptions';

export type MatchesStackParamList = {
  MatchesList: undefined;
  MatchDetail: { matchId: string };
  LiveScoring: { matchId: string };
};

const Stack = createNativeStackNavigator<MatchesStackParamList>();

export default function MatchesStack() {
  return (
    <Stack.Navigator id={undefined} screenOptions={navScreenOptions}>
      <Stack.Screen name="MatchesList" component={MatchesListScreen} options={{ title: 'Matches' }} />
      <Stack.Screen name="MatchDetail" component={MatchDetailScreen} options={{ title: 'Match' }} />
      <Stack.Screen name="LiveScoring" component={LiveScoringScreen} options={{ title: 'Live Scoring' }} />
    </Stack.Navigator>
  );
}
