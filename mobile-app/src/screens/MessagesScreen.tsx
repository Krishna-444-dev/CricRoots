// Messages inbox - one row per person the logged-in user has exchanged direct messages with,
// most-recently-active first (see backend/src/controllers/directMessageController.js#getConversations).
// Refetches on every focus (not just mount) so the unread badges here - and on the Profile tab -
// stay in sync after reading a thread, without needing a socket connection for this v1 pass.
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { Conversation } from '../shared/types';

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : d.toLocaleDateString();
}

export default function MessagesScreen({ navigation }: any) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.messages.getConversations()
      .then(({ conversations: rows }) => setConversations(rows))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load messages'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => { setRefreshing(true); load(); };

  const openThread = (conversation: Conversation) => {
    navigation.navigate('MessageThread', {
      userId: conversation.user._id,
      name: conversation.user.name,
    });
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.pitch400} size="large" />
      </View>
    );
  }

  return (
    <FlatList
      style={styles.container}
      data={conversations}
      keyExtractor={(item) => item.user._id}
      contentContainerStyle={conversations.length === 0 ? styles.emptyContent : styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
      ListEmptyComponent={
        <View style={styles.centered}>
          <Ionicons name="chatbubbles-outline" size={32} color={colors.inkMuted} />
          <Text style={styles.muted}>
            {error || 'No conversations yet - message a player from their profile to start one.'}
          </Text>
        </View>
      }
      renderItem={({ item }) => (
        <TouchableOpacity style={styles.row} onPress={() => openThread(item)} activeOpacity={0.8}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.user.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
          </View>
          <View style={styles.rowMain}>
            <View style={styles.rowTop}>
              <Text style={styles.rowName} numberOfLines={1}>{item.user.name}</Text>
              <Text style={styles.rowTime}>{formatTimestamp(item.lastMessage.createdAt)}</Text>
            </View>
            <Text style={[styles.rowPreview, item.unreadCount > 0 && styles.rowPreviewUnread]} numberOfLines={1}>
              {item.lastMessage.fromMe ? 'You: ' : ''}{item.lastMessage.text}
            </Text>
          </View>
          {item.unreadCount > 0 && (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadBadgeText}>{item.unreadCount > 9 ? '9+' : item.unreadCount}</Text>
            </View>
          )}
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  emptyContent: { flexGrow: 1 },
  listContent: { padding: 16 },
  muted: { color: colors.inkMuted, fontSize: 13, textAlign: 'center', marginTop: 10 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 10,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: colors.pitch900,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.pitch400, fontSize: 18, fontWeight: 'bold' },
  rowMain: { flex: 1 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowName: { color: colors.ink, fontSize: 15, fontWeight: '700', flex: 1, marginRight: 8 },
  rowTime: { color: colors.inkMuted, fontSize: 11 },
  rowPreview: { color: colors.inkMuted, fontSize: 13, marginTop: 3 },
  rowPreviewUnread: { color: colors.inkSecondary, fontWeight: '600' },

  unreadBadge: {
    minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.pitch500,
    alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6,
  },
  unreadBadgeText: { color: colors.background, fontSize: 11, fontWeight: '800' },
});
