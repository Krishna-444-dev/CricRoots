// Create a new group chat (POST /api/groups). Optionally tag it to a team you're on - selecting
// a team prefills the member picker with that team's current roster (a one-time copy, not a
// live sync - see backend/src/models/Group.js) - and pick additional members from the full
// player directory, same discovery source as NetworkScreen.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator, Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { useAuth } from '../hooks/useAuth';
import { Team } from '../shared/types';

// Same loose typing rationale as NetworkScreen/TeamDetailScreen - which fields arrive populated
// depends on the endpoint, so these are treated as "maybe populated" rather than cast to a
// stricter shape the response doesn't actually guarantee.
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

export default function CreateGroupScreen({ navigation, route }: any) {
  const { user } = useAuth();
  // Optional preset when reached from a team's "Create a Group" button (see TeamDetailScreen) -
  // preselects that team once its roster has loaded, same as picking it manually below.
  const presetTeamId: string | undefined = route?.params?.teamId;

  const [name, setName] = useState('');
  const [directory, setDirectory] = useState<DirectoryPlayer[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [teamModalOpen, setTeamModalOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.players.getPlayers(), api.teams.getTeams()])
      .then(([playersRes, teamsRes]) => {
        setDirectory(playersRes.players || []);
        setTeams(teamsRes.teams || []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load players'))
      .finally(() => setLoading(false));
  }, []);

  const directoryById = useMemo(() => {
    const map = new Map<string, DirectoryPlayer>();
    directory.forEach((p) => map.set(p._id, p));
    return map;
  }, [directory]);

  const toggleMember = (userId: string) => {
    if (!userId || userId === user?.id) return; // self is always included, not toggleable
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) next.delete(userId); else next.add(userId);
      return next;
    });
  };

  const selectTeam = useCallback(async (team: Team | null) => {
    setTeamModalOpen(false);
    setSelectedTeam(team);
    if (!team) return;
    try {
      const { team: full } = await api.teams.getTeamById(team._id);
      const rosterUserIds = (full.players || [])
        .map((p) => directoryById.get(resolveId(p)))
        .filter((p): p is DirectoryPlayer => !!p)
        .map((p) => getUserId(p))
        .filter(Boolean);
      setSelectedMemberIds((prev) => new Set([...prev, ...rosterUserIds]));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load team roster');
    }
  }, [directoryById]);

  // Auto-select the preset team (if any) once both the directory and team list have loaded, so
  // resolving the roster to user ids above has something to look up against.
  useEffect(() => {
    if (!presetTeamId || loading || selectedTeam) return;
    const match = teams.find((t) => t._id === presetTeamId);
    if (match) selectTeam(match);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [presetTeamId, loading, teams]);

  const filteredDirectory = directory.filter((p) =>
    getUserName(p).toLowerCase().includes(search.trim().toLowerCase())
  );

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const { group } = await api.groups.createGroup({
        name: name.trim(),
        teamId: selectedTeam?._id,
        memberIds: [...selectedMemberIds],
      });
      navigation.replace('GroupDetail', { groupId: group._id, name: group.name });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create group.');
      setSubmitting(false);
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
    <View style={styles.flex}>
      <FlatList
        style={styles.container}
        data={filteredDirectory}
        keyExtractor={(item) => item._id}
        contentContainerStyle={{ paddingBottom: 32 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View>
            <View style={styles.section}>
              <Text style={styles.label}>Group Name</Text>
              <TextInput
                style={styles.input}
                value={name}
                onChangeText={setName}
                placeholder="e.g. Riverside Strikers Squad"
                placeholderTextColor={colors.inkMuted}
              />

              <Text style={styles.label}>Team (optional)</Text>
              <TouchableOpacity style={styles.teamPicker} onPress={() => setTeamModalOpen(true)}>
                <Text style={selectedTeam ? styles.teamPickerText : styles.teamPickerPlaceholder}>
                  {selectedTeam ? selectedTeam.name : 'No team selected'}
                </Text>
                <Ionicons name="chevron-down" size={16} color={colors.inkMuted} />
              </TouchableOpacity>
              {!!selectedTeam && (
                <TouchableOpacity onPress={() => selectTeam(null)}>
                  <Text style={styles.clearTeamText}>Clear team selection</Text>
                </TouchableOpacity>
              )}

              {!!error && <Text style={styles.errorText}>{error}</Text>}
            </View>

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Members ({selectedMemberIds.size + 1})</Text>
            </View>
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={16} color={colors.inkMuted} />
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
          </View>
        }
        renderItem={({ item }) => {
          const userId = getUserId(item);
          const isSelf = !!user && userId === user.id;
          const checked = isSelf || selectedMemberIds.has(userId);
          return (
            <TouchableOpacity
              style={styles.memberRow}
              onPress={() => toggleMember(userId)}
              disabled={isSelf || !userId}
              activeOpacity={0.7}
            >
              <Ionicons
                name={checked ? 'checkbox' : 'square-outline'}
                size={22}
                color={checked ? colors.pitch400 : colors.inkMuted}
              />
              <View style={{ flex: 1 }}>
                <Text style={styles.memberName}>{getUserName(item)}{isSelf ? ' (You)' : ''}</Text>
                {!!item.specialization && <Text style={styles.memberMeta}>{item.specialization}</Text>}
              </View>
            </TouchableOpacity>
          );
        }}
        ListEmptyComponent={<Text style={styles.muted}>No players found.</Text>}
      />

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={handleCreate} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.submitBtnText}>Create Group</Text>}
        </TouchableOpacity>
      </View>

      <Modal visible={teamModalOpen} animationType="slide" transparent onRequestClose={() => setTeamModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Select Team</Text>
              <TouchableOpacity onPress={() => setTeamModalOpen(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={teams}
              keyExtractor={(t) => t._id}
              style={{ maxHeight: 420 }}
              ListEmptyComponent={<Text style={styles.muted}>No teams available.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.pickerRow} onPress={() => selectTeam(item)}>
                  <Text style={styles.pickerName}>{item.name}</Text>
                  <Text style={styles.pickerMeta}>{item.city}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, padding: 24 },
  muted: { color: colors.inkMuted, fontSize: 13, textAlign: 'center', padding: 16 },

  section: { padding: 16, paddingBottom: 4 },
  label: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 12 },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12, color: colors.ink, fontSize: 15,
  },
  teamPicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 12,
  },
  teamPickerText: { color: colors.ink, fontSize: 15 },
  teamPickerPlaceholder: { color: colors.inkMuted, fontSize: 15 },
  clearTeamText: { color: colors.wicket400, fontSize: 12, fontWeight: '600', marginTop: 8 },
  errorText: { color: colors.wicket400, fontSize: 13, marginTop: 14 },

  sectionHeaderRow: { paddingHorizontal: 16, paddingTop: 12 },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, marginHorizontal: 16, marginTop: 10, marginBottom: 4,
    paddingHorizontal: 12, paddingVertical: 10,
  },
  searchInput: { flex: 1, color: colors.ink, fontSize: 14 },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.surface,
    borderRadius: 12, borderWidth: 1, borderColor: colors.border, padding: 12, marginHorizontal: 16, marginTop: 8,
  },
  memberName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  memberMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },

  footer: { padding: 16, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface },
  submitBtn: { backgroundColor: colors.pitch500, borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.background, fontWeight: '700', fontSize: 15 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderWidth: 1, borderColor: colors.border, paddingBottom: 24, maxHeight: '75%',
  },
  modalHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
  modalClose: { color: colors.pitch400, fontSize: 14, fontWeight: '600' },
  pickerRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  pickerName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  pickerMeta: { color: colors.inkMuted, fontSize: 12 },
});
