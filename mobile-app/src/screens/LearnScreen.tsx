import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { Lesson } from '../shared/types';

const CATEGORIES = ['batting', 'bowling', 'fielding', 'fitness', 'rules', 'strategy'];

function authorName(author: Lesson['author']): string {
  return typeof author === 'string' ? 'Unknown' : author.name;
}

export default function LearnScreen() {
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [category, setCategory] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.lessons.getLessons()
      .then(({ lessons }) => setLessons(lessons))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load lessons'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(); };

  const visibleLessons = category ? lessons.filter(l => l.category === category) : lessons;

  return (
    <View style={styles.container}>
      <View style={styles.chipsRow}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={['', ...CATEGORIES]}
          keyExtractor={(item) => item || 'all'}
          contentContainerStyle={styles.chipsContent}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[styles.chip, category === item && styles.chipActive]}
              onPress={() => setCategory(item)}
            >
              <Text style={[styles.chipText, category === item && styles.chipTextActive]}>
                {item === '' ? 'All' : item}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {loading ? (
        <Text style={styles.muted}>Loading...</Text>
      ) : error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : (
        <FlatList
          data={visibleLessons}
          keyExtractor={(item) => item._id}
          contentContainerStyle={styles.listContent}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
          ListEmptyComponent={<Text style={styles.muted}>No lessons yet{category ? ` in ${category}` : ''}.</Text>}
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
                    <Text style={styles.badgeText}>{item.difficulty}</Text>
                  </View>
                </View>
                <Text style={styles.cardMeta}>{item.category} · by {authorName(item.author)}</Text>
                {expanded && (
                  <View style={styles.expandedBody}>
                    <Text style={styles.contentText}>{item.content}</Text>
                  </View>
                )}
                <View style={styles.expandRow}>
                  <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.inkMuted} />
                  <Text style={styles.expandLabel}>{expanded ? 'Show less' : 'Read lesson'}</Text>
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
  chipsRow: { borderBottomWidth: 1, borderBottomColor: colors.border, paddingVertical: 10 },
  chipsContent: { paddingHorizontal: 16, gap: 8 },
  chip: {
    backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7, marginRight: 8,
  },
  chipActive: { backgroundColor: colors.pitch500 },
  chipText: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
  chipTextActive: { color: '#06170D' },
  listContent: { padding: 16 },
  muted: { color: colors.inkMuted, textAlign: 'center', marginTop: 24 },
  errorText: { color: colors.wicket400, textAlign: 'center', marginTop: 24, paddingHorizontal: 16 },
  card: {
    backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.border,
    padding: 14, marginBottom: 10,
  },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  cardTitle: { color: colors.ink, fontSize: 15, fontWeight: '600', flex: 1 },
  cardMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 4, textTransform: 'capitalize' },
  badge: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { color: colors.gold400, fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
  expandedBody: { marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: colors.border },
  contentText: { color: colors.inkSecondary, fontSize: 14, lineHeight: 20 },
  expandRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
  expandLabel: { color: colors.inkMuted, fontSize: 12, fontWeight: '600' },
});
