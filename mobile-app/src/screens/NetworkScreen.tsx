// Network screen - the player directory / discovery entry point (HomeStack -> "Network").
// Lists every registered Player (api.players.getPlayers(), populated with its owning User),
// lets the signed-in user follow/unfollow others, and taps through to a player's stats.
//
// Following operates on User ids (usersAPI), not Player ids - a Player's `user` field is the
// User id to follow. There is no dedicated user-search endpoint, so the player directory
// doubles as the browsable list (matches the web-app/app/network/page.tsx equivalent).
import React, { useCallback, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, TextInput, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { useAuth } from '../hooks/useAuth';

// Populated Player.user from GET /players is a raw Mongoose User doc ({_id, name, email, role}),
// which doesn't match shared/types' `User` interface ({id, ...}) built for the auth response -
// treated loosely here rather than forcing a cast onto a type it doesn't actually satisfy.
interface DirectoryPlayer {
  _id: string;
  specialization: string;
  user: { _id?: string; id?: string; name?: string } | string | null;
}

function getUserId(p: DirectoryPlayer): string | null {
  if (!p.user) return null;
  if (typeof p.user === 'string') return p.user;
  return p.user._id || p.user.id || null;
}

function getUserName(p: DirectoryPlayer): string {
  if (!p.user) return 'Unknown Player';
  if (typeof p.user === 'string') return 'Player';
  return p.user.name || 'Player';
}

export default function NetworkScreen({ navigation }: any) {
  const { user } = useAuth();
  const [players, setPlayers] = useState<DirectoryPlayer[]>([]);
  const [followingIds, setFollowingIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    const tasks: [Promise<{ success: true; players: DirectoryPlayer[] }>, Promise<{ success: true; following: any[] }> | null] = [
      api.players.getPlayers(),
      user ? api.users.getFollowing(user.id) : null,
    ];

    Promise.all([tasks[0], tasks[1] ?? Promise.resolve(null)])
      .then(([playersRes, followingRes]) => {
        setPlayers(playersRes.players || []);
        if (followingRes) {
          setFollowingIds(new Set(followingRes.following.map((u: any) => u._id || u.id)));
        }
      })
      .catch(() => setPlayers([]))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const toggleFollow = async (targetUserId: string) => {
    if (!user || busyId) return;
    const isFollowing = followingIds.has(targetUserId);
    setBusyId(targetUserId);
    // Optimistic toggle - reverted below if the request fails.
    setFollowingIds(prev => {
      const next = new Set(prev);
      if (isFollowing) next.delete(targetUserId); else next.add(targetUserId);
      return next;
    });
    try {
      if (isFollowing) await api.users.unfollow(targetUserId);
      else await api.users.follow(targetUserId);
    } catch {
      setFollowingIds(prev => {
        const next = new Set(prev);
        if (isFollowing) next.add(targetUserId); else next.delete(targetUserId);
        return next;
      });
    } finally {
      setBusyId(null);
    }
  };

  const filteredPlayers = players.filter(p =>
    getUserName(p).toLowerCase().includes(search.trim().toLowerCase())
  );

  const viewStats = (playerId: string) => {
    navigation.navigate('Profile', { screen: 'PlayerStats', params: { playerId } });
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={18} color={colors.inkMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search players..."
          placeholderTextColor={colors.inkMuted}
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      {loading ? (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.pitch400} size="large" />
        </View>
      ) : (
        <FlatList
          data={filteredPlayers}
          keyExtractor={item => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
          ListEmptyComponent={
            <View style={styles.centered}>
              <Ionicons name="people-outline" size={32} color={colors.inkMuted} />
              <Text style={styles.muted}>
                {players.length === 0 ? 'No registered players yet.' : 'No players match your search.'}
              </Text>
            </View>
          }
          renderItem={({ item }) => {
            const targetUserId = getUserId(item);
            const isSelf = !!user && !!targetUserId && user.id === targetUserId;
            const isFollowing = !!targetUserId && followingIds.has(targetUserId);

            return (
              <TouchableOpacity style={styles.card} onPress={() => viewStats(item._id)} activeOpacity={0.8}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getUserName(item).charAt(0).toUpperCase()}</Text>
                </View>
                <View style={styles.cardInfo}>
                  <Text style={styles.cardName}>{getUserName(item)}</Text>
                  <Text style={styles.cardSpec}>{item.specialization}</Text>
                </View>
                {isSelf ? (
                  <View style={styles.youBadge}>
                    <Text style={styles.youBadgeText}>You</Text>
                  </View>
                ) : user && targetUserId ? (
                  <TouchableOpacity
                    style={[styles.followButton, isFollowing && styles.followButtonActive]}
                    disabled={busyId === targetUserId}
                    onPress={() => toggleFollow(targetUserId)}
                  >
                    <Text style={[styles.followButtonText, isFollowing && styles.followButtonTextActive]}>
                      {isFollowing ? 'Following' : 'Follow'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, margin: 16, marginBottom: 8,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40, gap: 8 },
  muted: { color: colors.inkMuted, textAlign: 'center' },
  listContent: { padding: 16, paddingTop: 8, flexGrow: 1 },
  card: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, borderRadius: 12,
    borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10, gap: 12,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.pitch900,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.pitch400, fontSize: 18, fontWeight: 'bold' },
  cardInfo: { flex: 1 },
  cardName: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  cardSpec: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  followButton: {
    borderWidth: 1, borderColor: colors.pitch500, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: colors.pitch500,
  },
  followButtonActive: { backgroundColor: 'transparent', borderColor: colors.border },
  followButtonText: { color: colors.background, fontSize: 12, fontWeight: '700' },
  followButtonTextActive: { color: colors.inkSecondary },
  youBadge: {
    backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6,
  },
  youBadgeText: { color: colors.inkMuted, fontSize: 12, fontWeight: '600' },
});
