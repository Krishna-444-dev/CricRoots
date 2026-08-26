import React from 'react';
import { Text, TouchableOpacity, StyleSheet, TextStyle, StyleProp } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { colors } from '../theme';

// A player or team NAME as a tap target - the semantic link in a cricket UI.
//
// Deliberately wraps only the name, never the whole row. A scorecard line is a table: the figures
// have to stay readable and independently selectable, and making the entire row navigate would
// mean you cannot look at "57 (41)" without being one mis-tap away from leaving the page.
//
// The affordance is a slightly brighter weight plus a hairline underline in the accent colour,
// not a web-style underline on every name - on a scorecard with twenty-two names that would be
// visual noise.
//
// Navigation note: PlayerStats/TeamDetail are registered in MatchesStack, TeamsStack and
// TournamentsStack (see navigation/stacks), so this pushes onto the CURRENT stack and Back returns
// to where the user tapped. Without that registration this would either crash or bounce the user
// into another tab.

// ID-SPACE HAZARD, worth stating because it has already caused one latent bug in this codebase
// (see ProfileScreen.openMyStats): a User id and a Player id are DIFFERENT documents. PlayerStats
// takes a Player id. Anywhere the only id available is a User id - the predictions leaderboard
// (entry.userId), message threads, follower lists - this component must NOT be used, because the
// route would resolve to nothing. Those screens are deliberately left as plain text.

interface Props {
  id?: string | null;
  name?: string | null;
  fallback?: string;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}

function useIdentityNav() {
  const navigation = useNavigation<any>();
  return {
    openPlayer: (playerId: string) => navigation.push?.('PlayerStats', { playerId })
      ?? navigation.navigate('PlayerStats', { playerId }),
    openTeam: (teamId: string) => navigation.push?.('TeamDetail', { teamId })
      ?? navigation.navigate('TeamDetail', { teamId }),
  };
}

export function PlayerLink({ id, name, fallback = 'Player', style, numberOfLines }: Props) {
  const { openPlayer } = useIdentityNav();
  const label = name ?? fallback;
  if (!id) return <Text style={style} numberOfLines={numberOfLines}>{label}</Text>;
  return (
    <TouchableOpacity onPress={() => openPlayer(id)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}>
      <Text style={[style, s.link]} numberOfLines={numberOfLines}>{label}</Text>
    </TouchableOpacity>
  );
}

export function TeamLink({ id, name, fallback = 'Team', style, numberOfLines }: Props) {
  const { openTeam } = useIdentityNav();
  const label = name ?? fallback;
  if (!id) return <Text style={style} numberOfLines={numberOfLines}>{label}</Text>;
  return (
    <TouchableOpacity onPress={() => openTeam(id)} hitSlop={{ top: 6, bottom: 6, left: 4, right: 8 }}>
      <Text style={[style, s.link]} numberOfLines={numberOfLines}>{label}</Text>
    </TouchableOpacity>
  );
}

const s = StyleSheet.create({
  link: {
    color: colors.ink,
    borderBottomWidth: 1,
    borderBottomColor: colors.pitch700,
  },
});
