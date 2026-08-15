// In-app notification feed - a followed team's match going Live/Completed, or a tournament
// announcement for a team rostered in that tournament (see backend/src/services/
// notificationService.js for exactly who gets notified). No push/email delivery yet: this
// screen and the tab-bar badge (MainTabNavigator) are the only place notifications surface,
// polled the same way DMs are (see MessagesScreen.tsx's equivalent pattern).
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { AppNotification } from '../shared/types';

function timeAgo(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

// Maps a notification's relative `link` (a real frontend path, e.g. `/match/<id>` or
// `/tournaments?tournamentId=<id>` - see backend/src/services/notificationService.js) to the
// mobile screen/params that show the same thing, the same way HomeScreen already maps a match
// card tap to `navigation.navigate('Matches', { screen: 'MatchDetail', params: { matchId } })`.
function resolveNotificationLink(link: string): { tab: string; screen: string; params: Record<string, string> } | null {
  if (!link) return null;
  const [pathPart, queryPart = ''] = link.split('?');

  const matchMatch = pathPart.match(/^\/match\/([^/?]+)/);
  if (matchMatch) {
    return { tab: 'Matches', screen: 'MatchDetail', params: { matchId: matchMatch[1] } };
  }

  if (pathPart === '/tournaments') {
    const tournamentIdMatch = queryPart.match(/(?:^|&)tournamentId=([^&]+)/);
    if (tournamentIdMatch) {
      return { tab: 'Tournaments', screen: 'TournamentDetail', params: { tournamentId: decodeURIComponent(tournamentIdMatch[1]) } };
    }
  }

  return null;
}

const TYPE_ICON: Record<AppNotification['type'], keyof typeof Ionicons.glyphMap> = {
  match_live: 'radio',
  match_completed: 'checkmark-circle',
  tournament_announcement: 'megaphone',
};

export default function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.notifications.getNotifications()
      .then(({ notifications: rows }) => setNotifications(rows))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load notifications'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => { setRefreshing(true); load(); };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    api.notifications.markAllRead().catch(() => {});
  };

  const openNotification = (n: AppNotification) => {
    if (!n.read) {
      setNotifications((prev) => prev.map((x) => (x._id === n._id ? { ...x, read: true } : x)));
      api.notifications.markRead(n._id).catch(() => {});
    }
    const target = resolveNotificationLink(n.link);
    if (target) {
      navigation.navigate(target.tab, { screen: target.screen, params: target.params });
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.pitch400} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {unreadCount > 0 && (
        <TouchableOpacity style={styles.markAllBtn} onPress={markAllRead}>
          <Ionicons name="checkmark-done-outline" size={18} color={colors.pitch400} />
          <Text style={styles.markAllBtnText}>Mark all read</Text>
        </TouchableOpacity>
      )}

      <FlatList
        style={styles.list}
        data={notifications}
        keyExtractor={(item) => item._id}
        contentContainerStyle={notifications.length === 0 ? styles.emptyContent : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="notifications-outline" size={32} color={colors.inkMuted} />
            <Text style={styles.muted}>{error || 'No notifications yet.'}</Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.row, !item.read && styles.rowUnread]}
            onPress={() => openNotification(item)}
            activeOpacity={0.8}
          >
            <View style={styles.iconCircle}>
              <Ionicons name={TYPE_ICON[item.type] || 'notifications'} size={18} color={colors.pitch400} />
            </View>
            <View style={styles.rowMain}>
              <View style={styles.rowTop}>
                <Text style={[styles.rowTitle, !item.read && styles.rowTitleUnread]} numberOfLines={1}>
                  {item.title}
                </Text>
                {!item.read && <View style={styles.unreadDot} />}
              </View>
              <Text style={styles.rowMessage} numberOfLines={2}>{item.message}</Text>
              <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  emptyContent: { flexGrow: 1 },
  listContent: { padding: 16 },
  muted: { color: colors.inkMuted, fontSize: 13, textAlign: 'center', marginTop: 10 },

  markAllBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, margin: 16, marginBottom: 4,
  },
  markAllBtnText: { color: colors.pitch400, fontSize: 14, fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 12, backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 10,
  },
  rowUnread: { borderColor: colors.pitch900, backgroundColor: colors.pitch900 + '33' },
  iconCircle: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: colors.pitch900,
    alignItems: 'center', justifyContent: 'center',
  },
  rowMain: { flex: 1 },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowTitle: { color: colors.inkSecondary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  rowTitleUnread: { color: colors.ink, fontWeight: '800' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pitch400 },
  rowMessage: { color: colors.inkMuted, fontSize: 13, marginTop: 3 },
  rowTime: { color: colors.inkMuted, fontSize: 11, marginTop: 4 },
});
