import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { scorebook, NUM } from '../theme/scorebook';
import { resolveRefName } from '../shared/utils/resolveRef';
import { useAuth } from '../hooks/useAuth';
import { api } from '../shared/api/apiClient';

const DEFAULT_NOTIF_PREFS = { push: true, email: true };

export default function ProfileScreen({ navigation }: any) {
  const { user, logout } = useAuth();
  const [resolvingStats, setResolvingStats] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifPrefs, setNotifPrefs] = useState(user?.notificationPreferences ?? DEFAULT_NOTIF_PREFS);
  const [savingChannel, setSavingChannel] = useState<'push' | 'email' | null>(null);
  // The cricketing identity this screen now leads with. Profile used to open on an avatar, an
  // email address and a list of settings rows - i.e. an ACCOUNT screen that happened to contain
  // cricket links. A cricketer's profile should open on their cricket.
  const [me, setMe] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

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

  // Re-pulls the current preferences from the server on every focus (rather than trusting the
  // in-memory `user` object, which only reflects login/register-time values - see useAuth's
  // normalizeUser) so this stays correct after a toggle here, a app restart, etc.
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api.auth.getCurrentUser()
        .then(({ user: freshUser }) => {
          if (freshUser?.notificationPreferences) setNotifPrefs(freshUser.notificationPreferences);
        })
        .catch(() => {});
    }, [user])
  );

  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      api.players.getMyProfile()
        .then(({ player }) => {
          setMe(player);
          return api.playerStats.getStats(player._id);
        })
        .then((r) => setStats(r?.stats ?? null))
        .catch(() => { /* no Player doc yet - the identity block falls back to the account name */ });
    }, [user])
  );

  const toggleNotifPref = async (channel: 'push' | 'email', value: boolean) => {
    const previous = notifPrefs;
    setNotifPrefs((prev) => ({ ...prev, [channel]: value }));
    setSavingChannel(channel);
    try {
      const payload = channel === 'push' ? { push: value } : { email: value };
      const { notificationPreferences } = await api.users.updateNotificationPreferences(payload);
      setNotifPrefs(notificationPreferences);
    } catch (error) {
      setNotifPrefs(previous);
      Alert.alert('Could not update preference', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSavingChannel(null);
    }
  };

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

  const bat = stats?.batting ?? null;
  const bowl = stats?.bowling ?? null;
  const teamNames: string[] = ((me?.teams ?? []) as any[]).map((t) => resolveRefName(t, 'Team')).filter(Boolean);
  const styleLine = [me?.specialization, me?.battingStyle && `${me.battingStyle} bat`, me?.bowlingStyle !== 'None' && me?.bowlingStyle]
    .filter(Boolean).join(' · ');

  return (
    <ScrollView style={scorebook.screen} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* IDENTITY - who this cricketer is, before anything about the account. */}
      <View style={styles.identity}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user?.name?.charAt(0) ?? '?'}</Text>
        </View>
        <Text style={styles.name}>{user?.name ?? 'Cricketer'}</Text>
        {teamNames.length > 0 && <Text style={styles.club}>{teamNames.join(' · ')}</Text>}
        {!!styleLine && <Text style={styles.styleLine}>{styleLine}</Text>}
      </View>

      {/* SEASON - the scorebook line. Figures first, labels subordinate. */}
      {bat && bat.innings > 0 && (
        <>
          <View style={scorebook.headingRow}>
            <Text style={scorebook.heading}>Batting</Text>
            <View style={scorebook.headingRule} />
          </View>
          <View style={scorebook.figureStrip}>
            <View style={scorebook.figure}>
              <Text style={scorebook.figureValue}>{bat.runs}</Text>
              <Text style={scorebook.figureLabel}>Runs</Text>
            </View>
            <View style={scorebook.figureDivider} />
            <View style={[scorebook.figure, { paddingLeft: 18 }]}>
              <Text style={scorebook.figureValue}>{Number(bat.average ?? 0).toFixed(1)}</Text>
              <Text style={scorebook.figureLabel}>Average</Text>
            </View>
            <View style={scorebook.figureDivider} />
            <View style={[scorebook.figure, { paddingLeft: 18 }]}>
              <Text style={scorebook.figureValue}>{Number(bat.strikeRate ?? 0).toFixed(1)}</Text>
              <Text style={scorebook.figureLabel}>Strike rate</Text>
            </View>
          </View>
          <Text style={styles.subFigures}>
            {bat.innings} innings · high score {bat.highestScore ?? 0} · {bat.balls ?? 0} balls faced
          </Text>
        </>
      )}

      {bowl && (bowl.wickets ?? 0) >= 0 && (bowl.balls ?? 0) > 0 && (
        <>
          <View style={scorebook.headingRow}>
            <Text style={scorebook.heading}>Bowling</Text>
            <View style={scorebook.headingRule} />
          </View>
          <View style={scorebook.figureStrip}>
            <View style={scorebook.figure}>
              <Text style={scorebook.figureValue}>{bowl.wickets ?? 0}</Text>
              <Text style={scorebook.figureLabel}>Wickets</Text>
            </View>
            <View style={scorebook.figureDivider} />
            <View style={[scorebook.figure, { paddingLeft: 18 }]}>
              <Text style={scorebook.figureValue}>{Number(bowl.economyRate ?? 0).toFixed(2)}</Text>
              <Text style={scorebook.figureLabel}>Economy</Text>
            </View>
            <View style={scorebook.figureDivider} />
            <View style={[scorebook.figure, { paddingLeft: 18 }]}>
              <Text style={scorebook.figureValue}>{Number(bowl.average ?? 0).toFixed(1)}</Text>
              <Text style={scorebook.figureLabel}>Average</Text>
            </View>
          </View>
          <Text style={styles.subFigures}>
            {Math.floor((bowl.balls ?? 0) / 6)}.{(bowl.balls ?? 0) % 6} overs · {bowl.runs ?? 0} runs conceded
          </Text>
        </>
      )}

      {!bat && (
        <Text style={scorebook.empty}>
          Your batting and bowling record will appear here once you have played a match.
        </Text>
      )}

      {/* MY CRICKET */}
      <View style={scorebook.headingRow}>
        <Text style={scorebook.heading}>My cricket</Text>
        <View style={scorebook.headingRule} />
      </View>
      <TouchableOpacity style={scorebook.row} onPress={openMyStats} disabled={resolvingStats}>
        <Ionicons name="stats-chart" size={17} color={colors.pitch400} />
        <Text style={scorebook.rowTitle}>Full record & achievements</Text>
      </TouchableOpacity>
      <TouchableOpacity style={scorebook.row} onPress={() => navigation.navigate('Leaderboard')}>
        <Ionicons name="podium" size={17} color={colors.gold400} />
        <Text style={scorebook.rowTitle}>Predictions leaderboard</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[scorebook.row, scorebook.rowLast]} onPress={() => navigation.navigate('Assistant')}>
        <Ionicons name="sparkles" size={17} color={colors.pitch400} />
        <Text style={scorebook.rowTitle}>Assistant</Text>
      </TouchableOpacity>

      {/* CLUBHOUSE */}
      <View style={scorebook.headingRow}>
        <Text style={scorebook.heading}>Clubhouse</Text>
        <View style={scorebook.headingRule} />
      </View>
      <TouchableOpacity style={scorebook.row} onPress={() => navigation.navigate('Messages')}>
        <Ionicons name="chatbubble-ellipses" size={17} color={colors.inkSecondary} />
        <Text style={scorebook.rowTitle}>Messages</Text>
        {unreadCount > 0 && (
          <View style={styles.unreadBadge}>
            <Text style={styles.unreadBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={[scorebook.row, scorebook.rowLast]} onPress={() => navigation.navigate('Groups')}>
        <Ionicons name="people-circle" size={17} color={colors.inkSecondary} />
        <Text style={scorebook.rowTitle}>Groups</Text>
      </TouchableOpacity>

      {/* ACCOUNT - last, where settings belong on a cricketer's profile. */}
      <View style={scorebook.headingRow}>
        <Text style={scorebook.heading}>Account</Text>
        <View style={scorebook.headingRule} />
      </View>
      <View style={scorebook.row}>
        <Ionicons name="notifications" size={17} color={colors.inkMuted} />
        <Text style={[scorebook.rowTitle, { flex: 1 }]}>Push notifications</Text>
        <Switch
          value={notifPrefs.push}
          onValueChange={(v) => toggleNotifPref('push', v)}
          disabled={savingChannel === 'push'}
          trackColor={{ true: colors.pitch600, false: colors.border }}
          thumbColor={colors.ink}
        />
      </View>
      <View style={scorebook.row}>
        <Ionicons name="mail" size={17} color={colors.inkMuted} />
        <Text style={[scorebook.rowTitle, { flex: 1 }]}>Email notifications</Text>
        <Switch
          value={notifPrefs.email}
          onValueChange={(v) => toggleNotifPref('email', v)}
          disabled={savingChannel === 'email'}
          trackColor={{ true: colors.pitch600, false: colors.border }}
          thumbColor={colors.ink}
        />
      </View>
      <TouchableOpacity style={[scorebook.row, scorebook.rowLast]} onPress={confirmLogout}>
        <Ionicons name="log-out" size={17} color={colors.wicket400} />
        <Text style={[scorebook.rowTitle, { color: colors.wicket400 }]}>Log out</Text>
      </TouchableOpacity>

      <Text style={styles.accountEmail}>{user?.email}</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  identity: {
    alignItems: 'center',
    paddingTop: 28,
    paddingBottom: 24,
    paddingHorizontal: 20,
  },
  avatar: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 2,
    borderColor: colors.pitch600,
    backgroundColor: colors.pitch900,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.pitch400,
  },
  name: {
    fontSize: 24,
    fontWeight: '800',
    color: colors.ink,
    letterSpacing: -0.3,
  },
  club: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.pitch400,
    marginTop: 6,
  },
  styleLine: {
    fontSize: 12,
    color: colors.inkMuted,
    marginTop: 5,
  },
  subFigures: {
    paddingHorizontal: 20,
    marginTop: 12,
    fontSize: 12,
    color: colors.inkMuted,
  },
  unreadBadge: {
    minWidth: 20,
    height: 20,
    borderRadius: 10,
    paddingHorizontal: 6,
    backgroundColor: colors.wicket500,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unreadBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  accountEmail: {
    textAlign: 'center',
    marginTop: 26,
    fontSize: 11,
    color: colors.inkMuted,
  },
});
