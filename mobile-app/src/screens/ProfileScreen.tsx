import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { api } from '../shared/api/apiClient';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [resolvingStats, setResolvingStats] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Refetched on every focus (not just mount) so the badge clears promptly after reading a
  // thread and coming back, without needing a socket connection for this v1 pass.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api.messages.getUnreadCount()
        .then(({ count }) => setUnreadCount(count))
        .catch(() => {});
    }, [user])
  );

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  // PlayerStatsScreen expects a Player document id, which is a different id space from
  // `user.id` (a User document id) - passing user.id straight through was a latent bug.
  // Resolve the logged-in user's own Player doc first via /players/me/profile. A 404 here means
  // this user has no Player doc yet (e.g. registered via mobile, which never collected one) -
  // route them to CompleteProfileScreen to create one instead of dead-ending on an Alert, and
  // send them straight to their new stats page once they're done.
  const openMyStats = async () => {
    if (resolvingStats) return;
    setResolvingStats(true);
    try {
      const { player } = await api.players.getMyProfile();
      navigation.navigate('PlayerStats', { playerId: player._id });
    } catch {
      navigation.navigate('CompleteProfile', { onSuccessGoToStats: true });
    } finally {
      setResolvingStats(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) ?? '?'}</Text>
        </View>
        <Text style={styles.name}>{user?.name ?? 'Player'}</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>

      <TouchableOpacity style={styles.row} onPress={openMyStats} disabled={resolvingStats}>
        <Ionicons name="stats-chart-outline" size={20} color={colors.pitch400} />
        <Text style={styles.rowText}>My Stats & Achievements</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Leaderboard')}>
        <Ionicons name="trophy-outline" size={20} color={colors.gold400} />
        <Text style={styles.rowText}>Predictions Leaderboard</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Messages')}>
        <Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.pitch400} />
        <Text style={styles.rowText}>Messages</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
        <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Groups')}>
        <Ionicons name="people-circle-outline" size={20} color={colors.pitch400} />
        <Text style={styles.rowText}>Groups</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('Assistant')}>
        <Ionicons name="sparkles-outline" size={20} color={colors.pitch400} />
        <Text style={styles.rowText}>Assistant</Text>
        <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
      </TouchableOpacity>

      <TouchableOpacity style={styles.row} onPress={confirmLogout}>
        <Ionicons name="log-out-outline" size={20} color={colors.wicket400} />
        <Text style={[styles.rowText, { color: colors.wicket400 }]}>Log out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, padding: 16 },
  card: {
    backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', padding: 24, marginBottom: 16,
  },
  avatar: {
    width: 64, height: 64, borderRadius: 32, backgroundColor: colors.pitch900,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText: { color: colors.pitch400, fontSize: 28, fontWeight: 'bold' },
  name: { color: colors.ink, fontSize: 18, fontWeight: 'bold' },
  email: { color: colors.inkSecondary, fontSize: 13, marginTop: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, marginBottom: 10,
  },
  rowText: { color: colors.ink, fontSize: 14, fontWeight: '600', flex: 1 },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.pitch500,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5, marginRight: 4,
  },
  unreadBadgeText: { color: colors.background, fontSize: 10, fontWeight: '800' },
});
