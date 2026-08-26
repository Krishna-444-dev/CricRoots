// Cricbuzz-style live striker/non-striker/bowler figures - mobile port of web-app's "At the
// Crease" block (see web-app/app/match/[id]/page.tsx, search "At the Crease"). Pure display
// component: the data already arrives on the match object's innings[i].liveState (saved by the
// scorer's client on every ball), so this needs no fetch of its own.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';
import { PlayerLink } from './IdentityLink';
import type { LiveState } from '../shared/types';

interface AtTheCreaseProps {
  liveState: LiveState;
}

export default function AtTheCrease({ liveState }: AtTheCreaseProps) {
  const bowler = liveState.currentBowler;
  const bowlerStats = bowler
    ? liveState.bowlingScorecard.find((e) => e.player.id === bowler.id)
    : null;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>At the Crease</Text>
      <View style={styles.batsmenList}>
        {liveState.currentBatsmen.map((batsman, i) => {
          if (!batsman) return null;
          const stats = liveState.battingScorecard.find((e) => e.player.id === batsman.id);
          const isStriker = i === 0;
          return (
            <View key={batsman.id} style={styles.row}>
              <PlayerLink
                id={batsman.id}
                name={`${batsman.name}${isStriker ? ' *' : ''}`}
                style={[styles.name, isStriker && styles.nameStriker] as any}
                numberOfLines={1}
              />
              <Text style={styles.figures}>
                {stats ? `${stats.runs} (${stats.balls})` : '0 (0)'}
                {stats && stats.balls > 0 ? `  SR ${stats.strikeRate.toFixed(1)}` : ''}
              </Text>
            </View>
          );
        })}
      </View>
      {bowler && (
        <View style={styles.bowlerRow}>
          <PlayerLink id={bowler.id} name={bowler.name} style={styles.name} numberOfLines={1} />
          <Text style={styles.figures}>
            {bowlerStats
              ? `${bowlerStats.wickets}-${bowlerStats.runs} (${bowlerStats.overs}.${bowlerStats.balls})  Econ ${bowlerStats.economy.toFixed(2)}`
              : '0-0 (0.0)'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
  },
  title: {
    color: colors.inkMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginBottom: 10,
  },
  batsmenList: { gap: 6 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { color: colors.inkSecondary, fontSize: 14, flexShrink: 1, marginRight: 8 },
  nameStriker: { color: colors.ink, fontWeight: '700' },
  figures: { color: colors.inkSecondary, fontSize: 13 },
  bowlerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
