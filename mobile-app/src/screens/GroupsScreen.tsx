// My Groups - WhatsApp-style team group chats the logged-in user is a member of
// (GET /api/groups). Refetches on every focus, same fetch-on-focus convention as
// MessagesScreen/MessageThreadScreen (no socket wiring for this v1 pass).
import React, { useCallback, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { Group } from '../shared/types';

export default function GroupsScreen({ navigation }: any) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    api.groups.getGroups()
      .then(({ groups: rows }) => setGroups(rows))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load groups'))
      .finally(() => { setLoading(false); setRefreshing(false); });
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const onRefresh = () => { setRefreshing(true); load(); };

  const openGroup = (group: Group) => {
    navigation.navigate('GroupDetail', { groupId: group._id, name: group.name });
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
      <TouchableOpacity style={styles.newGroupBtn} onPress={() => navigation.navigate('CreateGroup')}>
        <Ionicons name="add-circle" size={20} color={colors.pitch400} />
        <Text style={styles.newGroupBtnText}>New Group</Text>
      </TouchableOpacity>

      <FlatList
        style={styles.list}
        data={groups}
        keyExtractor={(item) => item._id}
        contentContainerStyle={groups.length === 0 ? styles.emptyContent : styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="people-circle-outline" size={32} color={colors.inkMuted} />
            <Text style={styles.muted}>
              {error || 'No groups yet - create one to start chatting with your team.'}
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => openGroup(item)} activeOpacity={0.8}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{item.name?.charAt(0)?.toUpperCase() ?? '?'}</Text>
            </View>
            <View style={styles.rowMain}>
              <Text style={styles.rowName} numberOfLines={1}>{item.name}</Text>
              <Text style={styles.rowSub} numberOfLines={1}>
                {item.team ? `${item.team.name} · ` : ''}{item.members.length} member{item.members.length === 1 ? '' : 's'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.inkMuted} />
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
  listContent: { padding: 16, paddingTop: 8 },
  muted: { color: colors.inkMuted, fontSize: 13, textAlign: 'center', marginTop: 10 },

  newGroupBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 14, margin: 16, marginBottom: 4,
  },
  newGroupBtnText: { color: colors.pitch400, fontSize: 14, fontWeight: '700' },

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
  rowName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  rowSub: { color: colors.inkMuted, fontSize: 12, marginTop: 3 },
});
