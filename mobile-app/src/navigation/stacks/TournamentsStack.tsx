import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import TournamentsListScreen from '../../screens/TournamentsListScreen';
import TournamentDetailScreen from '../../screens/TournamentDetailScreen';
import CreateTournamentScreen from '../../screens/CreateTournamentScreen';
import LeaguesListScreen from '../../screens/LeaguesListScreen';
import LeagueDetailScreen from '../../screens/LeagueDetailScreen';
import CreateLeagueScreen from '../../screens/CreateLeagueScreen';
import { navScreenOptions } from '../screenOptions';

export type TournamentsStackParamList = {
  TournamentsList: undefined;
  TournamentDetail: { tournamentId: string };
  // leagueId is set when arriving from a league's "Create Tournament" action (see
  // LeagueDetailScreen) to pre-select that league in the form.
  CreateTournament: { leagueId?: string } | undefined;
  // Leagues live in this same stack (rather than a separate tab) since there's no persistent
  // nav slot for them yet - reachable via the "Leagues" link on TournamentsListScreen.
  LeaguesList: undefined;
  LeagueDetail: { leagueId: string };
  CreateLeague: undefined;
};

const Stack = createNativeStackNavigator<TournamentsStackParamList>();

export default function TournamentsStack() {
  return (
    <Stack.Navigator id={undefined} screenOptions={navScreenOptions}>
      <Stack.Screen name="TournamentsList" component={TournamentsListScreen} options={{ title: 'Tournaments' }} />
      <Stack.Screen name="TournamentDetail" component={TournamentDetailScreen} options={{ title: 'Tournament' }} />
      <Stack.Screen name="CreateTournament" component={CreateTournamentScreen} options={{ title: 'New Tournament' }} />
      <Stack.Screen name="LeaguesList" component={LeaguesListScreen} options={{ title: 'Leagues' }} />
      <Stack.Screen name="LeagueDetail" component={LeagueDetailScreen} options={{ title: 'League' }} />
      <Stack.Screen name="CreateLeague" component={CreateLeagueScreen} options={{ title: 'New League' }} />
    </Stack.Navigator>
  );
}
