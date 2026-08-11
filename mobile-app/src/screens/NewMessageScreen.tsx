// Pick a player to start a new direct-message conversation with (there was previously no way
// to initiate a DM from the Messages tab itself - only by finding someone's profile first).
// Same player-directory discovery source as CreateGroupScreen/NetworkScreen.
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { useAuth } from '../hooks/useAuth';

interface DirectoryPlayer {
  _id: string;
  specialization?: string;
  user: { _id?: string; id?: string; name?: string } | string | null;
}

function resolveId(ref: any): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  return ref._id || ref.id || '';
}

function getUserId(p: DirectoryPlayer): string {
  return resolveId(p.user);
}

function getUserName(p: DirectoryPlayer): string {
  if (!p.user) return 'Unknown Player';
  if (typeof p.user === 'string') return 'Player';
  return p.user.name || 'Player';
}

export default function NewMessageScreen({ navigation }: any) {
  const { user } = useAuth();
  const [directory, setDirectory] = useState<DirectoryPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    api.players.getPlayers()
      .then(({ players }) => setDirectory(players || []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return directory
      .filter((p) => getUserId(p) && getUserId(p) !== user?.id)
      .filter((p) => !q || getUserName(p).toLowerCase().includes(q));
  }, [directory, search, user]);

  const openThread = (p: DirectoryPlayer) => {
    navigation.replace('MessageThread', { userId: getUserId(p), name: getUserName(p) });
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
      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={16} color={colors.inkMuted} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search players..."
          placeholderTextColor={colors.inkMuted}
          value={search}
          onChangeText={setSearch}
          autoFocus
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item._id}
        contentContainerStyle={filtered.length === 0 ? styles.emptyContent : styles.listContent}
        ListEmptyComponent={<Text style={styles.muted}>No players found.</Text>}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.row} onPress={() => openThread(item)} activeOpacity={0.8}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{getUserName(item).charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <Text style={styles.rowName}>{getUserName(item)}</Text>
              {!!item.specialization && <Text style={styles.rowMeta}>{item.specialization}</Text>}
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  emptyContent: { flexGrow: 1, alignItems: 'center', justifyContent: 'center' },
  listContent: { padding: 16 },
  muted: { color: colors.inkMuted, fontSize: 13 },

  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceAlt,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 10,
    margin: 16, marginBottom: 4,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginBottom: 10,
  },
  avatar: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.pitch900,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { color: colors.pitch400, fontSize: 16, fontWeight: 'bold' },
  rowName: { color: colors.ink, fontSize: 15, fontWeight: '700' },
  rowMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
});
