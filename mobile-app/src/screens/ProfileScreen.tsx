import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useAuth } from '../hooks/useAuth';
import { api } from '../shared/api/apiClient';

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [resolvingStats, setResolvingStats] = useState(false);

  const confirmLogout = () => {
    Alert.alert('Log out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Log out', style: 'destructive', onPress: () => logout() },
    ]);
  };

  // PlayerStatsScreen expects a Player document id, which is a different id space from
  // `user.id` (a User document id) - passing user.id straight through was a latent bug.
  // Resolve the logged-in user's own Player doc first via /players/me/profile.
  const openMyStats = async () => {
    if (resolvingStats) return;
    setResolvingStats(true);
    try {
      const { player } = await api.players.getMyProfile();
      navigation.navigate('PlayerStats', { playerId: player._id });
    } catch (err) {
      Alert.alert(
        'No player profile yet',
        err instanceof Error ? err.message : 'Register a player profile to view stats.'
      );
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
});
