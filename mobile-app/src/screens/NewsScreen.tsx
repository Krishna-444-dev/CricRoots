import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { NewsPost } from '../shared/types';

function authorName(author: NewsPost['author']): string {
  return typeof author === 'string' ? 'Unknown' : author.name;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export default function NewsScreen() {
  const [posts, setPosts] = useState<NewsPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.news.getPosts()
      .then(({ posts }) => setPosts(posts))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load news'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  return (
    <View style={styles.container}>
      {loading ? (
        <Text style={styles.muted}>Loading...</Text>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
          ListEmptyComponent={<Text style={styles.muted}>No news yet.</Text>}
          renderItem={({ item }) => {
            const expanded = expandedId === item._id;
            return (
              <TouchableOpacity
                style={styles.card}
                onPress={() => setExpandedId(expanded ? null : item._id)}
                activeOpacity={0.8}
              >
                <View style={styles.cardHeaderRow}>
                  <Text style={styles.cardTitle}>{item.title}</Text>
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{item.category}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>{authorName(item.author)} · {formatDate(item.createdAt)}</Text>
                {expanded ? (
                  <View style={styles.expandedBody}>
                    <Text style={styles.contentText}>{item.body}</Text>
                  </View>
                ) : (
                  <Text style={styles.previewText} numberOfLines={2}>{item.body}</Text>
                )}
                <View style={styles.expandRow}>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkMuted} />
                  <Text style={styles.expandLabel}>{expanded ? 'Show less' : 'Read more'}</Text>
                </View>
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
  listContent: { padding: 16 },
  muted: { color: colors.inkMuted, textAlign: 'center', marginTop: 24 },
  errorText: { color: colors.wicket400, textAlign: 'center', marginTop: 24, paddingHorizontal: 16 },
  card: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 10,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', flex: 1 },
  cardMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 4 },
  badge: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: colors.gold400, fontSize: 11, fontWeight: '700' },
  previewText: { color: colors.inkSecondary, fontSize: 13, lineHeight: 18, marginTop: 8 },
  expandedBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  contentText: { color: colors.inkSecondary, fontSize: 14, lineHeight: 20 },
  expandRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  expandLabel: { color: colors.inkMuted, fontSize: 12, fontWeight: '600' },
});
