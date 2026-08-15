import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, TextInput, ActivityIndicator } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { League } from '../shared/types';
import { useAuth } from '../hooks/useAuth';

function LeagueCard({ league, onPress }: { league: League; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress}>
      <Text style={styles.cardTitle} numberOfLines={1}>{league.name}</Text>
      {!!league.description && <Text style={styles.cardSub} numberOfLines={2}>{league.description}</Text>}
      <Text style={styles.cardMeta}>
        Organized by {typeof league.organizer === 'string' ? 'Unknown' : league.organizer?.name || 'Unknown'}
      </Text>
    </TouchableOpacity>
  );
}

export default function LeaguesListScreen({ navigation }: any) {
  const { user } = useAuth();
  const [myLeagues, setMyLeagues] = useState<League[]>([]);
  const [myLeaguesLoading, setMyLeaguesLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<League[] | null>(null);
  const [searching, setSearching] = useState(false);

  const loadMine = useCallback(() => {
    if (!user) {
      setMyLeaguesLoading(false);
      setRefreshing(false);
      return;
    }
    api.leagues
      .getMyLeagues()
      .then(({ leagues }) => setMyLeagues(leagues))
      .catch(() => setMyLeagues([]))
      .finally(() => {
        setMyLeaguesLoading(false);
        setRefreshing(false);
      });
  }, [user]);

  useEffect(() => {
    loadMine();
  }, [loadMine]);

  // Every other league is search-only, never fetched or shown by default - matches web-app's
  // leagues page. Clearing the box clears results rather than falling back to "show everything".
  useEffect(() => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchResults(null);
      return;
    }
    setSearching(true);
    const handle = setTimeout(() => {
      api.leagues
        .searchLeagues(term)
        .then(({ leagues }) => setSearchResults(leagues))
        .catch(() => setSearchResults([]))
        .finally(() => setSearching(false));
    }, 300);
    return () => clearTimeout(handle);
  }, [searchTerm]);

  return (
    <FlatList
      style={styles.container}
      data={searchResults ?? []}
      keyExtractor={(item) => item._id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadMine(); }} tintColor={colors.pitch400} />}
      ListHeaderComponent={
        <>
          <View style={styles.header}>
            <Text style={styles.title}>Leagues</Text>
            <TouchableOpacity style={styles.createBtn} onPress={() => navigation.navigate('CreateLeague')}>
              <Text style={styles.createBtnText}>+ New League</Text>
            </TouchableOpacity>
          </View>

          {user && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>My Leagues</Text>
              {myLeaguesLoading ? (
                <ActivityIndicator color={colors.pitch400} style={{ marginTop: 8 }} />
              ) : myLeagues.length === 0 ? (
                <Text style={styles.muted}>You&apos;re not part of any league yet. Search below to find one to join, or create your own.</Text>
              ) : (
                myLeagues.map((league) => (
                  <LeagueCard key={league._id} league={league} onPress={() => navigation.navigate('LeagueDetail', { leagueId: league._id })} />
                ))
              )}
            </View>
          )}

          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Find a League</Text>
            <TextInput
              value={searchTerm}
              onChangeText={setSearchTerm}
              placeholder="Search leagues by name..."
              placeholderTextColor={colors.inkMuted}
              style={styles.searchInput}
            />
            {searching && <ActivityIndicator color={colors.pitch400} style={{ marginTop: 8 }} />}
            {!searching && searchResults === null && (
              <Text style={styles.muted}>Start typing to find a league by name.</Text>
            )}
            {!searching && searchResults !== null && searchResults.length === 0 && (
              <Text style={styles.muted}>No leagues match &quot;{searchTerm.trim()}&quot;.</Text>
            )}
          </View>
        </>
      }
      renderItem={({ item }) => (
        <LeagueCard league={item} onPress={() => navigation.navigate('LeagueDetail', { leagueId: item._id })} />
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16 },
  title: { color: colors.ink, fontSize: 22, fontWeight: 'bold' },
  createBtn: { backgroundColor: colors.pitch500, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  createBtnText: { color: colors.background, fontWeight: '700', fontSize: 13 },
  muted: { color: colors.inkMuted, marginTop: 4 },
  list: { paddingHorizontal: 16, paddingBottom: 24 },
  section: { marginBottom: 20 },
  sectionLabel: { color: colors.inkSecondary, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 10 },
  searchInput: { backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.borderStrong, color: colors.ink, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14 },
  card: { backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  cardSub: { color: colors.inkSecondary, fontSize: 12, marginTop: 6 },
  cardMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 4 },
});
