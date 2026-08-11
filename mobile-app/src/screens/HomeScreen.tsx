import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { Match } from '../shared/types';

interface QuickLink {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  screen: string;
  tab?: string;
}

const QUICK_LINKS: QuickLink[] = [
  { label: 'Matches', icon: 'baseball', screen: 'MatchesList', tab: 'Matches' },
  { label: 'Teams', icon: 'people', screen: 'TeamsList', tab: 'Teams' },
  { label: 'Tournaments', icon: 'trophy', screen: 'TournamentsList', tab: 'Tournaments' },
  { label: 'Network', icon: 'person-add', screen: 'Network', tab: 'Home' },
  { label: 'Learn', icon: 'book', screen: 'Learn', tab: 'Home' },
  { label: 'News', icon: 'newspaper', screen: 'News', tab: 'Home' },
  { label: 'Market', icon: 'cart', screen: 'Marketplace', tab: 'Home' },
];

function teamName(team: Match['team1']): string {
  return typeof team === 'string' ? 'Team' : team.name;
}

export default function HomeScreen({ navigation }: any) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    api.matches.getMatches()
      .then(({ matches }) => setMatches(matches.slice(0, 5)))
      .catch(() => setMatches([]))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const openQuickLink = (link: QuickLink) => {
    if (link.tab && link.tab !== 'Home') {
      navigation.navigate(link.tab, { screen: link.screen });
    } else {
      navigation.navigate(link.screen);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
    >
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>BUILT FOR LOCAL & CLUB CRICKET</Text>
        <Text style={styles.heroTitle}>One app for your entire cricket season</Text>
      </View>

      <View style={styles.quickLinksGrid}>
        {QUICK_LINKS.map(link => (
          <TouchableOpacity key={link.label} style={styles.quickLink} onPress={() => openQuickLink(link)}>
            <Ionicons name={link.icon} size={24} color={colors.pitch400} />
            <Text style={styles.quickLinkLabel}>{link.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent & Upcoming Matches</Text>
        {loading ? (
          <Text style={styles.muted}>Loading...</Text>
        ) : matches.length === 0 ? (
          <Text style={styles.muted}>No matches yet.</Text>
        ) : (
          matches.map(match => (
            <TouchableOpacity
              key={match._id}
              style={styles.matchCard}
              onPress={() => navigation.navigate('Matches', { screen: 'MatchDetail', params: { matchId: match._id } })}
            >
              <View style={styles.matchCardRow}>
                <Text style={styles.matchTeams}>{teamName(match.team1)} vs {teamName(match.team2)}</Text>
                <View style={[styles.statusBadge, match.status === 'Live' && styles.statusBadgeLive]}>
                  <Text style={styles.statusBadgeText}>{match.status}</Text>
                </View>
              </View>
              <Text style={styles.matchVenue}>{match.venue}</Text>
            </TouchableOpacity>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  hero: { padding: 20, paddingTop: 24 },
  heroKicker: { color: colors.gold500, fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 8 },
  heroTitle: { color: colors.ink, fontSize: 26, fontWeight: 'bold', lineHeight: 32 },
  quickLinksGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 10 },
  quickLink: {
    width: '30%', margin: '1.5%', backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center', paddingVertical: 16,
  },
  quickLinkLabel: { color: colors.inkSecondary, fontSize: 12, marginTop: 6, fontWeight: '600' },
  section: { padding: 16 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: 'bold', marginBottom: 12 },
  muted: { color: colors.inkMuted },
  matchCard: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 10,
  },
  matchCardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchTeams: { color: colors.ink, fontSize: 15, fontWeight: '600', flexShrink: 1 },
  matchVenue: { color: colors.inkMuted, fontSize: 12, marginTop: 4 },
  statusBadge: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeLive: { backgroundColor: colors.pitch900 },
  statusBadgeText: { color: colors.inkSecondary, fontSize: 11, fontWeight: '700' },
});
