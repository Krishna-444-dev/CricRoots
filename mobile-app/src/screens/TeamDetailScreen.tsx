import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
} from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { Team } from '../shared/types';
import { useAuth } from '../hooks/useAuth';

// Populated relations (captain, players, message.sender) depend entirely on which endpoint
// returned them - GET /teams/:id only shallow-populates captain/players (a Player doc whose
// own `user` field is a bare ObjectId string), so real display names come from cross-referencing
// against the /players directory (which DOES populate `user`), not from the team response alone.
function resolveId(ref: any): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  return ref._id || ref.id || '';
}

function playerDisplayName(player: any): string {
  if (!player) return 'Player';
  const user = player.user;
  if (user && typeof user === 'object') return user.name || 'Player';
  return player.specialization || 'Player';
}

interface Props {
  route: { params: { teamId: string } };
  navigation: any;
}

export default function TeamDetailScreen({ route, navigation }: Props) {
  const { teamId } = route.params;
  const { user } = useAuth();

  const [team, setTeam] = useState<Team | null>(null);
  const [directory, setDirectory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [addPickerOpen, setAddPickerOpen] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const [viceCaptainPickerOpen, setViceCaptainPickerOpen] = useState(false);
  const [settingViceCaptainId, setSettingViceCaptainId] = useState<string | null>(null);
  const [clearingViceCaptain, setClearingViceCaptain] = useState(false);
  const [coachPickerOpen, setCoachPickerOpen] = useState(false);
  const [addingCoachId, setAddingCoachId] = useState<string | null>(null);
  const [removingCoachId, setRemovingCoachId] = useState<string | null>(null);
  const [roleError, setRoleError] = useState('');

  // null = not loaded yet / not permitted to view (team chat is member-only server-side;
  // rather than pre-computing membership client-side, we just attempt the fetch and hide
  // the whole section on a 403 instead of surfacing an error for a normal, expected case).
  const [messages, setMessages] = useState<any[] | null>(null);
  const [messageText, setMessageText] = useState('');
  const [postingMessage, setPostingMessage] = useState(false);

  const load = useCallback(() => {
    setError('');
    Promise.all([api.teams.getTeamById(teamId), api.players.getPlayers().catch(() => ({ players: [] }))])
      .then(([teamRes, playersRes]) => {
        setTeam(teamRes.team);
        setDirectory(playersRes.players || []);
      })
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load team'))
      .finally(() => {
        setLoading(false);
        setRefreshing(false);
      });
  }, [teamId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api.teams
      .getMessages(teamId)
      .then(({ messages }) => setMessages(messages))
      .catch(() => setMessages(null));
  }, [teamId]);

  const directoryById = useMemo(() => {
    const map = new Map<string, any>();
    directory.forEach(p => map.set(p._id, p));
    return map;
  }, [directory]);

  const captainId = team ? resolveId(team.captain) : '';
  const captainPlayer = captainId
    ? directoryById.get(captainId) || (typeof team?.captain === 'object' ? team?.captain : undefined)
    : undefined;
  const captainUserId = captainPlayer ? resolveId((captainPlayer as any).user) : '';
  const isCaptain = !!user && !!captainUserId && captainUserId === user.id;

  const viceCaptainId = team ? resolveId(team.viceCaptain) : '';
  const viceCaptainPlayer = viceCaptainId
    ? directoryById.get(viceCaptainId) || (typeof team?.viceCaptain === 'object' ? team?.viceCaptain : undefined)
    : undefined;
  const viceCaptainUserId = viceCaptainPlayer ? resolveId((viceCaptainPlayer as any).user) : '';
  const isViceCaptain = !!user && !!viceCaptainUserId && viceCaptainUserId === user.id;

  const coachIds = useMemo(() => new Set((team?.coaches || []).map(resolveId)), [team]);
  const isCoach = useMemo(() => {
    if (!user) return false;
    return Array.from(coachIds).some(id => {
      const player = directoryById.get(id);
      return player && resolveId((player as any).user) === user.id;
    });
  }, [coachIds, directoryById, user]);

  // Admin-level: day-to-day roster/team management is delegable to vice-captain/coaches.
  // Structural actions (delete team, role assignment) stay isCaptain-only below.
  const isAdmin = isCaptain || isViceCaptain || isCoach;

  const rosterIds = useMemo(() => new Set((team?.players || []).map(resolveId)), [team]);

  const addablePlayers = useMemo(() => directory.filter(p => !rosterIds.has(p._id)), [directory, rosterIds]);

  // Roster players eligible for vice-captain/coach assignment - the captain is excluded since
  // they already hold the senior role.
  const roleCandidates = useMemo(
    () => directory.filter(p => rosterIds.has(p._id) && p._id !== captainId),
    [directory, rosterIds, captainId]
  );
  const coachCandidates = useMemo(
    () => roleCandidates.filter(p => !coachIds.has(p._id)),
    [roleCandidates, coachIds]
  );
  const coachPlayers = useMemo(
    () => Array.from(coachIds).map(id => directoryById.get(id)).filter(Boolean),
    [coachIds, directoryById]
  );

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const refreshTeam = async () => {
    const { team: updated } = await api.teams.getTeamById(teamId);
    setTeam(updated);
  };

  const handleAddPlayer = async (playerId: string) => {
    setAddingId(playerId);
    setError('');
    try {
      await api.teams.addPlayer(teamId, playerId);
      await refreshTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add player');
    } finally {
      setAddingId(null);
    }
  };

  const handleRemovePlayer = async (playerId: string) => {
    setRemovingId(playerId);
    setError('');
    try {
      await api.teams.removePlayer(teamId, playerId);
      await refreshTeam();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to remove player');
    } finally {
      setRemovingId(null);
    }
  };

  const handleSetViceCaptain = async (playerId: string) => {
    setSettingViceCaptainId(playerId);
    setRoleError('');
    try {
      await api.teams.setViceCaptain(teamId, playerId);
      setViceCaptainPickerOpen(false);
      await refreshTeam();
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Failed to set vice-captain');
    } finally {
      setSettingViceCaptainId(null);
    }
  };

  const handleClearViceCaptain = async () => {
    setClearingViceCaptain(true);
    setRoleError('');
    try {
      await api.teams.setViceCaptain(teamId, null);
      await refreshTeam();
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Failed to remove vice-captain');
    } finally {
      setClearingViceCaptain(false);
    }
  };

  const handleAddCoach = async (playerId: string) => {
    setAddingCoachId(playerId);
    setRoleError('');
    try {
      await api.teams.addCoach(teamId, playerId);
      setCoachPickerOpen(false);
      await refreshTeam();
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Failed to add coach');
    } finally {
      setAddingCoachId(null);
    }
  };

  const handleRemoveCoach = async (playerId: string) => {
    setRemovingCoachId(playerId);
    setRoleError('');
    try {
      await api.teams.removeCoach(teamId, playerId);
      await refreshTeam();
    } catch (err) {
      setRoleError(err instanceof Error ? err.message : 'Failed to remove coach');
    } finally {
      setRemovingCoachId(null);
    }
  };

  const handlePostMessage = async () => {
    if (!messageText.trim()) return;
    setPostingMessage(true);
    try {
      await api.teams.postMessage(teamId, messageText.trim());
      setMessageText('');
      const { messages: updated } = await api.teams.getMessages(teamId);
      setMessages(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post message');
    } finally {
      setPostingMessage(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.pitch400} />
      </View>
    );
  }

  if (!team) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error || 'Team not found.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.flex}>
      <FlatList
        style={styles.container}
        data={team.players || []}
        keyExtractor={item => resolveId(item)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.pitch400} />}
        contentContainerStyle={{ paddingBottom: 32 }}
        ListHeaderComponent={
          <View>
            <View style={styles.header}>
              <Text style={styles.teamName}>{team.name}</Text>
              <Text style={styles.teamSub}>{team.city}</Text>
              {!!team.description && <Text style={styles.teamDesc}>{team.description}</Text>}
              <View style={styles.captainRow}>
                <Text style={styles.captainLabel}>Captain</Text>
                <Text style={styles.captainName}>{captainPlayer ? playerDisplayName(captainPlayer) : 'Unknown'}</Text>
              </View>
            </View>

            {!!error && <Text style={styles.errorBanner}>{error}</Text>}

            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Roster ({team.players?.length ?? 0})</Text>
              {isAdmin && (
                <TouchableOpacity style={styles.addBtn} onPress={() => setAddPickerOpen(true)}>
                  <Text style={styles.addBtnText}>+ Add Player</Text>
                </TouchableOpacity>
              )}
            </View>

            <TouchableOpacity
              style={styles.groupBtn}
              onPress={() => navigation.navigate('Profile', { screen: 'CreateGroup', params: { teamId } })}
            >
              <Text style={styles.groupBtnText}>Create a Group Chat for this team</Text>
            </TouchableOpacity>

            {isCaptain && (
              <View style={styles.rolesSection}>
                {!!roleError && <Text style={styles.errorBanner}>{roleError}</Text>}

                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Vice Captain</Text>
                  {!viceCaptainId && (
                    <TouchableOpacity style={styles.addBtn} onPress={() => setViceCaptainPickerOpen(true)}>
                      <Text style={styles.addBtnText}>+ Assign</Text>
                    </TouchableOpacity>
                  )}
                </View>
                {viceCaptainId ? (
                  <View style={styles.playerRow}>
                    <Text style={[styles.playerName, { flex: 1 }]}>
                      {viceCaptainPlayer ? playerDisplayName(viceCaptainPlayer) : 'Unknown'}
                    </Text>
                    <TouchableOpacity onPress={handleClearViceCaptain} disabled={clearingViceCaptain}>
                      <Text style={styles.removeText}>{clearingViceCaptain ? 'Removing...' : 'Remove'}</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.muted}>No vice-captain assigned.</Text>
                )}

                <View style={styles.sectionHeaderRow}>
                  <Text style={styles.sectionTitle}>Coaches ({coachPlayers.length})</Text>
                  <TouchableOpacity style={styles.addBtn} onPress={() => setCoachPickerOpen(true)}>
                    <Text style={styles.addBtnText}>+ Add Coach</Text>
                  </TouchableOpacity>
                </View>
                {coachPlayers.length === 0 ? (
                  <Text style={styles.muted}>No coaches assigned.</Text>
                ) : (
                  coachPlayers.map((c: any) => (
                    <View key={c._id} style={styles.playerRow}>
                      <Text style={[styles.playerName, { flex: 1 }]}>{playerDisplayName(c)}</Text>
                      <TouchableOpacity onPress={() => handleRemoveCoach(c._id)} disabled={removingCoachId === c._id}>
                        <Text style={styles.removeText}>{removingCoachId === c._id ? 'Removing...' : 'Remove'}</Text>
                      </TouchableOpacity>
                    </View>
                  ))
                )}
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const id = resolveId(item);
          const player = directoryById.get(id) || (typeof item === 'object' ? item : undefined);
          const isThisCaptain = id === captainId;
          const isThisViceCaptain = !!viceCaptainId && id === viceCaptainId;
          const isThisCoach = coachIds.has(id);
          return (
            <View style={styles.playerRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.playerName}>
                  {playerDisplayName(player)}
                  {isThisCaptain ? '  (C)' : ''}
                  {isThisViceCaptain ? '  (VC)' : ''}
                  {isThisCoach ? '  (Coach)' : ''}
                </Text>
                {!!player?.specialization && <Text style={styles.playerMeta}>{player.specialization}</Text>}
              </View>
              {isAdmin && !isThisCaptain && (
                <TouchableOpacity onPress={() => handleRemovePlayer(id)} disabled={removingId === id}>
                  <Text style={styles.removeText}>{removingId === id ? 'Removing...' : 'Remove'}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
        ListEmptyComponent={<Text style={styles.muted}>No players on this team yet.</Text>}
        ListFooterComponent={
          messages !== null ? (
            <View style={styles.chatSection}>
              <Text style={styles.sectionTitle}>Team Chat</Text>
              {messages.length === 0 ? (
                <Text style={styles.muted}>No messages yet.</Text>
              ) : (
                messages.slice(-20).map(m => (
                  <View key={m._id} style={styles.messageRow}>
                    <Text style={styles.messageSender}>{m.sender?.name || 'Member'}</Text>
                    <Text style={styles.messageText}>{m.text}</Text>
                  </View>
                ))
              )}
              <View style={styles.messageInputRow}>
                <TextInput
                  style={styles.messageInput}
                  value={messageText}
                  onChangeText={setMessageText}
                  placeholder="Message the team..."
                  placeholderTextColor={colors.inkMuted}
                />
                <TouchableOpacity
                  style={[styles.sendBtn, (!messageText.trim() || postingMessage) && styles.sendBtnDisabled]}
                  onPress={handlePostMessage}
                  disabled={postingMessage || !messageText.trim()}
                >
                  <Text style={styles.sendBtnText}>{postingMessage ? '...' : 'Send'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ) : null
        }
      />

      <Modal visible={addPickerOpen} animationType="slide" transparent onRequestClose={() => setAddPickerOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add Player</Text>
              <TouchableOpacity onPress={() => setAddPickerOpen(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={addablePlayers}
              keyExtractor={p => p._id}
              style={{ maxHeight: 420 }}
              ListEmptyComponent={<Text style={styles.muted}>No other players available to add.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  disabled={addingId === item._id}
                  onPress={() => handleAddPlayer(item._id)}
                >
                  <Text style={styles.pickerName}>{playerDisplayName(item)}</Text>
                  <Text style={styles.pickerMeta}>{addingId === item._id ? 'Adding...' : item.specialization || ''}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={viceCaptainPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setViceCaptainPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Assign Vice Captain</Text>
              <TouchableOpacity onPress={() => setViceCaptainPickerOpen(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={roleCandidates}
              keyExtractor={p => p._id}
              style={{ maxHeight: 420 }}
              ListEmptyComponent={<Text style={styles.muted}>No other roster players available.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  disabled={settingViceCaptainId === item._id}
                  onPress={() => handleSetViceCaptain(item._id)}
                >
                  <Text style={styles.pickerName}>{playerDisplayName(item)}</Text>
                  <Text style={styles.pickerMeta}>{settingViceCaptainId === item._id ? 'Setting...' : item.specialization || ''}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={coachPickerOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setCoachPickerOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>Add Coach</Text>
              <TouchableOpacity onPress={() => setCoachPickerOpen(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={coachCandidates}
              keyExtractor={p => p._id}
              style={{ maxHeight: 420 }}
              ListEmptyComponent={<Text style={styles.muted}>No other roster players available to add as coach.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerRow}
                  disabled={addingCoachId === item._id}
                  onPress={() => handleAddCoach(item._id)}
                >
                  <Text style={styles.pickerName}>{playerDisplayName(item)}</Text>
                  <Text style={styles.pickerMeta}>{addingCoachId === item._id ? 'Adding...' : item.specialization || ''}</Text>
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
  center: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { color: colors.wicket400, fontSize: 14, textAlign: 'center' },
  errorBanner: {
    color: colors.wicket400,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.wicket500,
    padding: 10,
    marginHorizontal: 16,
    marginBottom: 12,
    fontSize: 13,
  },
  header: { padding: 16, paddingBottom: 8 },
  teamName: { color: colors.ink, fontSize: 24, fontWeight: 'bold' },
  teamSub: { color: colors.inkSecondary, fontSize: 14, marginTop: 4 },
  teamDesc: { color: colors.inkMuted, fontSize: 13, marginTop: 8, lineHeight: 18 },
  captainRow: { flexDirection: 'row', alignItems: 'center', marginTop: 14 },
  captainLabel: { color: colors.gold500, fontSize: 12, fontWeight: '700', letterSpacing: 0.5, marginRight: 8 },
  captainName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  rolesSection: { marginTop: 8, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 4 },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  sectionTitle: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
  addBtn: { backgroundColor: colors.pitch500, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  addBtnText: { color: colors.background, fontWeight: '700', fontSize: 12 },
  groupBtn: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: colors.surface, borderWidth: 1,
    borderColor: colors.pitch500, borderRadius: 10, paddingVertical: 10, alignItems: 'center',
  },
  groupBtnText: { color: colors.pitch400, fontWeight: '700', fontSize: 13 },
  muted: { color: colors.inkMuted, paddingHorizontal: 16, paddingVertical: 12 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 8,
  },
  playerName: { color: colors.ink, fontSize: 15, fontWeight: '600' },
  playerMeta: { color: colors.inkMuted, fontSize: 12, marginTop: 2 },
  removeText: { color: colors.wicket400, fontSize: 12, fontWeight: '600' },
  chatSection: { marginTop: 16, paddingHorizontal: 16 },
  messageRow: { marginBottom: 10, backgroundColor: colors.surface, borderRadius: 10, borderWidth: 1, borderColor: colors.border, padding: 10 },
  messageSender: { color: colors.gold500, fontSize: 11, fontWeight: '700', marginBottom: 2 },
  messageText: { color: colors.ink, fontSize: 13 },
  messageInputRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 8 },
  messageInput: {
    flex: 1,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.ink,
    fontSize: 13,
  },
  sendBtn: { backgroundColor: colors.pitch500, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10 },
  sendBtnDisabled: { opacity: 0.5 },
  sendBtnText: { color: colors.background, fontWeight: '700', fontSize: 13 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: 24,
    maxHeight: '75%',
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
  modalClose: { color: colors.pitch400, fontSize: 14, fontWeight: '600' },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  pickerName: { color: colors.ink, fontSize: 14, fontWeight: '600' },
  pickerMeta: { color: colors.inkMuted, fontSize: 12 },
});
