import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TournamentsListScreen from '../../screens/TournamentsListScreen';
import TournamentDetailScreen from '../../screens/TournamentDetailScreen';
import { navScreenOptions } from '../screenOptions';

export type TournamentsStackParamList = {
  TournamentsList: undefined;
  TournamentDetail: { tournamentId: string };
};

const Stack = createNativeStackNavigator<TournamentsStackParamList>();

export default function TournamentsStack() {
  return (
    <Stack.Navigator id={undefined} screenOptions={navScreenOptions}>
      <Stack.Screen name="TournamentsList" component={TournamentsListScreen} options={{ title: 'Tournaments' }} />
      <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} options={{ title: 'Tournament' }} />
    </Stack.Navigator>
  );
}
