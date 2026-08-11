// A single group's chat feed - text bubbles, poll cards (tappable options + vote counts), and
// image/video attachments, interleaved chronologically (GET /api/groups/:id/messages). Creators
// get basic management (rename / add / remove members / delete) via the header's "..." menu;
// non-creator members get a "Leave group" option there instead.
//
// No socket wiring for this v1 pass - reloads on focus (same convention as MessagesScreen /
// MessageThreadScreen) plus optimistic local updates after posting/voting/uploading so the
// sender's own view updates immediately without waiting for a refetch.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform, Modal, Image, Alert, Switch, Linking, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { api, resolveAttachmentUrl } from '../shared/api/apiClient';
import { useAuth } from '../hooks/useAuth';
import { Group, GroupMessage } from '../shared/types';

function resolveId(ref: any): string {
  if (!ref) return '';
  if (typeof ref === 'string') return ref;
  return ref._id || ref.id || '';
}

function memberName(ref: any): string {
  if (!ref) return 'Member';
  if (typeof ref === 'string') return 'Member';
  return ref.name || 'Member';
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function guessMimeType(uri: string, assetType?: string | null): string {
  const ext = uri.split('?')[0].split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', gif: 'image/gif', webp: 'image/webp',
    mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
  };
  if (ext && map[ext]) return map[ext];
  return assetType === 'video' ? 'video/mp4' : 'image/jpeg';
}

interface DirectoryPlayer {
  _id: string;
  specialization?: string;
  user: { _id?: string; id?: string; name?: string } | string | null;
}

export default function GroupDetailScreen({ route, navigation }: any) {
  const groupId: string = route?.params?.groupId;
  const initialName: string | undefined = route?.params?.name;
  const { user } = useAuth();

  const [group, setGroup] = useState<Group | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [votingKey, setVotingKey] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  const [pollModalOpen, setPollModalOpen] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollSubmitting, setPollSubmitting] = useState(false);
  const [pollError, setPollError] = useState('');

  const [manageModalOpen, setManageModalOpen] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [manageBusyId, setManageBusyId] = useState<string | null>(null);
  const [manageError, setManageError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(() => {
    if (!groupId) {
      setError('No group specified.');
      setLoading(false);
      return;
    }
    setError(null);
    Promise.all([api.groups.getGroup(groupId), api.groups.getMessages(groupId)])
      .then(([groupRes, messagesRes]) => {
        setGroup(groupRes.group);
        setMessages(messagesRes.messages);
        setRenameText(groupRes.group.name);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load group'))
      .finally(() => setLoading(false));
  }, [groupId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const isCreator = !!user && !!group && resolveId(group.createdBy) === user.id;

  // --- Management ---
  const [addDirectory, setAddDirectory] = useState<DirectoryPlayer[] | null>(null);

  const openManage = useCallback(() => {
    setManageError('');
    setManageModalOpen(true);
    if (isCreator && addDirectory === null) {
      api.players.getPlayers()
        .then(({ players }) => setAddDirectory(players || []))
        .catch(() => setAddDirectory([]));
    }
  }, [isCreator, addDirectory]);

  useEffect(() => {
    navigation.setOptions({
      title: group?.name || initialName || 'Group',
      headerRight: () => (
        <TouchableOpacity onPress={openManage} style={{ paddingHorizontal: 12 }}>
          <Ionicons name="ellipsis-horizontal-circle-outline" size={24} color={colors.ink} />
        </TouchableOpacity>
      ),
    });
  }, [navigation, group, initialName, openManage]);

  const scrollToEnd = () => requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));

  // --- Text messages ---
  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !groupId) return;
    setSending(true);
    setText('');
    try {
      const { message } = await api.groups.postMessage(groupId, trimmed);
      setMessages((prev) => [...prev, message]);
      scrollToEnd();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  // --- Polls ---
  const resetPollForm = () => {
    setPollQuestion('');
    setPollOptions(['', '']);
    setPollAllowMultiple(false);
    setPollError('');
  };

  const updatePollOption = (idx: number, val: string) => {
    setPollOptions((prev) => prev.map((o, i) => (i === idx ? val : o)));
  };
  const addPollOption = () => {
    setPollOptions((prev) => (prev.length >= 10 ? prev : [...prev, '']));
  };
  const removePollOption = (idx: number) => {
    setPollOptions((prev) => (prev.length <= 2 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const submitPoll = async () => {
    const question = pollQuestion.trim();
    const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!question) { setPollError('A poll question is required.'); return; }
    if (cleanOptions.length < 2) { setPollError('Add at least 2 options.'); return; }
    setPollSubmitting(true);
    setPollError('');
    try {
      const { message } = await api.groups.createPoll(groupId, {
        question, options: cleanOptions, allowMultiple: pollAllowMultiple,
      });
      setMessages((prev) => [...prev, message]);
      setPollModalOpen(false);
      resetPollForm();
      scrollToEnd();
    } catch (e) {
      setPollError(e instanceof Error ? e.message : 'Failed to create poll');
    } finally {
      setPollSubmitting(false);
    }
  };

  // --- Voting ---
  const handleVote = async (message: GroupMessage, optionId: string) => {
    const key = `${message._id}:${optionId}`;
    if (votingKey) return;
    setVotingKey(key);
    try {
      const { message: updated } = await api.groups.vote(groupId, message._id, optionId);
      setMessages((prev) => prev.map((m) => (m._id === updated._id ? updated : m)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to vote');
    } finally {
      setVotingKey(null);
    }
  };

  // --- Attachments ---
  const pickAttachment = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('Permission needed', 'Allow photo library access to attach an image or video.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setUploading(true);
    setError(null);
    try {
      const type = asset.mimeType || guessMimeType(asset.uri, asset.type);
      const name = asset.fileName || asset.uri.split('/').pop() || `upload-${Date.now()}`;
      const { message } = await api.groups.postAttachment(groupId, { uri: asset.uri, name, type });
      setMessages((prev) => [...prev, message]);
      scrollToEnd();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to upload attachment');
    } finally {
      setUploading(false);
    }
  };

  const currentMemberIds = useMemo(
    () => new Set((group?.members || []).map((m) => resolveId(m))),
    [group]
  );

  const addablePlayers = useMemo(() => {
    if (!addDirectory) return [];
    return addDirectory.filter((p) => {
      const uid = resolveId(p.user);
      return uid && !currentMemberIds.has(uid);
    });
  }, [addDirectory, currentMemberIds]);

  const handleRename = async () => {
    const trimmed = renameText.trim();
    if (!trimmed || !group || trimmed === group.name) return;
    setSavingName(true);
    setManageError('');
    try {
      const { group: updated } = await api.groups.updateGroup(groupId, { name: trimmed });
      setGroup(updated);
    } catch (e) {
      setManageError(e instanceof Error ? e.message : 'Failed to rename group');
    } finally {
      setSavingName(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    setManageBusyId(userId);
    setManageError('');
    try {
      const { group: updated } = await api.groups.updateGroup(groupId, { addMemberIds: [userId] });
      setGroup(updated);
    } catch (e) {
      setManageError(e instanceof Error ? e.message : 'Failed to add member');
    } finally {
      setManageBusyId(null);
    }
  };

  const handleRemoveMember = (memberId: string) => {
    Alert.alert('Remove member', 'Remove this person from the group?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive', onPress: async () => {
          setManageBusyId(memberId);
          setManageError('');
          try {
            const { group: updated } = await api.groups.updateGroup(groupId, { removeMemberIds: [memberId] });
            setGroup(updated);
          } catch (e) {
            setManageError(e instanceof Error ? e.message : 'Failed to remove member');
          } finally {
            setManageBusyId(null);
          }
        },
      },
    ]);
  };

  const handleDeleteGroup = () => {
    Alert.alert('Delete group', 'This permanently deletes the group and all its messages. This can\'t be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setDeleting(true);
          try {
            await api.groups.deleteGroup(groupId);
            setManageModalOpen(false);
            navigation.goBack();
          } catch (e) {
            setManageError(e instanceof Error ? e.message : 'Failed to delete group');
            setDeleting(false);
          }
        },
      },
    ]);
  };

  const handleLeaveGroup = () => {
    Alert.alert('Leave group', 'You\'ll need to be re-added to rejoin. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave', style: 'destructive', onPress: async () => {
          setLeaving(true);
          try {
            await api.groups.leaveGroup(groupId);
            setManageModalOpen(false);
            navigation.goBack();
          } catch (e) {
            setManageError(e instanceof Error ? e.message : 'Failed to leave group');
            setLeaving(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.pitch400} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        style={styles.list}
        data={messages}
        keyExtractor={(item) => item._id}
        contentContainerStyle={messages.length === 0 ? styles.emptyContent : styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="chatbubbles-outline" size={28} color={colors.inkMuted} />
            <Text style={styles.muted}>{error || 'No messages yet - say hello.'}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const fromMe = !!user && item.sender._id === user.id;
          return (
            <View style={[styles.bubbleRow, fromMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
              <View style={[styles.bubbleWrap, fromMe ? styles.bubbleWrapMe : styles.bubbleWrapThem]}>
                {!fromMe && <Text style={styles.senderName}>{item.sender.name}</Text>}

                {item.type === 'text' && (
                  <View style={[styles.bubble, fromMe ? styles.bubbleMe : styles.bubbleThem]}>
                    <Text style={styles.bubbleText}>{item.text}</Text>
                    <Text style={styles.bubbleTime}>{formatTime(item.createdAt)}</Text>
                  </View>
                )}

                {item.type === 'poll' && item.poll && (
                  <View style={styles.pollCard}>
                    <Text style={styles.pollQuestion}>{item.poll.question}</Text>
                    {item.poll.allowMultiple && <Text style={styles.pollHint}>Select all that apply</Text>}
                    {item.poll.options.map((opt) => {
                      const myVote = !!user && opt.votes.some((v) => v._id === user.id);
                      const isVoting = votingKey === `${item._id}:${opt._id}`;
                      return (
                        <TouchableOpacity
                          key={opt._id}
                          style={[styles.pollOption, myVote && styles.pollOptionSelected]}
                          onPress={() => handleVote(item, opt._id)}
                          disabled={!!votingKey}
                        >
                          <Ionicons
                            name={myVote ? 'checkmark-circle' : 'ellipse-outline'}
                            size={18}
                            color={myVote ? colors.pitch400 : colors.inkMuted}
                          />
                          <Text style={styles.pollOptionText}>{opt.text}</Text>
                          {isVoting ? (
                            <ActivityIndicator size="small" color={colors.pitch400} />
                          ) : (
                            <Text style={styles.pollVoteCount}>{opt.votes.length}</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    <Text style={styles.bubbleTimePoll}>{formatTime(item.createdAt)}</Text>
                  </View>
                )}

                {(item.type === 'image' || item.type === 'video') && item.attachment && (
                  item.type === 'image' ? (
                    <View style={[styles.bubble, styles.attachmentBubble, fromMe ? styles.bubbleMe : styles.bubbleThem]}>
                      <Image
                        source={{ uri: resolveAttachmentUrl(item.attachment.url) }}
                        style={styles.attachmentImage}
                        resizeMode="cover"
                      />
                      <Text style={styles.bubbleTime}>{formatTime(item.createdAt)}</Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={[styles.bubble, styles.videoBubble, fromMe ? styles.bubbleMe : styles.bubbleThem]}
                      onPress={() => Linking.openURL(resolveAttachmentUrl(item.attachment!.url))}
                    >
                      <Ionicons name="play-circle-outline" size={22} color={colors.ink} />
                      <Text style={styles.videoText} numberOfLines={1}>{item.attachment.fileName || 'Video'}</Text>
                      <Text style={styles.bubbleTime}>{formatTime(item.createdAt)}</Text>
                    </TouchableOpacity>
                  )
                )}
              </View>
            </View>
          );
        }}
      />

      {error && messages.length > 0 && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.inputRow}>
        <TouchableOpacity style={styles.iconBtn} onPress={() => setPollModalOpen(true)} disabled={sending || uploading}>
          <Ionicons name="stats-chart-outline" size={20} color={colors.pitch400} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.iconBtn} onPress={pickAttachment} disabled={sending || uploading}>
          {uploading ? <ActivityIndicator size="small" color={colors.pitch400} /> : <Ionicons name="image-outline" size={20} color={colors.pitch400} />}
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor={colors.inkMuted}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
        >
          {sending ? <ActivityIndicator size="small" color={colors.background} /> : <Ionicons name="send" size={18} color={colors.background} />}
        </TouchableOpacity>
      </View>

      {/* Poll creation modal */}
      <Modal visible={pollModalOpen} animationType="slide" transparent onRequestClose={() => setPollModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>New Poll</Text>
              <TouchableOpacity onPress={() => { setPollModalOpen(false); resetPollForm(); }}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.label}>Question</Text>
              <TextInput
                style={styles.input}
                value={pollQuestion}
                onChangeText={setPollQuestion}
                placeholder="What are we asking?"
                placeholderTextColor={colors.inkMuted}
              />

              <Text style={styles.label}>Options</Text>
              {pollOptions.map((opt, idx) => (
                <View key={idx} style={styles.optionRow}>
                  <TextInput
                    style={[styles.input, styles.optionInput]}
                    value={opt}
                    onChangeText={(v) => updatePollOption(idx, v)}
                    placeholder={`Option ${idx + 1}`}
                    placeholderTextColor={colors.inkMuted}
                  />
                  {pollOptions.length > 2 && (
                    <TouchableOpacity onPress={() => removePollOption(idx)} style={styles.removeOptionBtn}>
                      <Ionicons name="close-circle" size={22} color={colors.wicket400} />
                    </TouchableOpacity>
                  )}
                </View>
              ))}
              {pollOptions.length < 10 && (
                <TouchableOpacity onPress={addPollOption} style={styles.addOptionBtn}>
                  <Ionicons name="add-circle-outline" size={18} color={colors.pitch400} />
                  <Text style={styles.addOptionText}>Add option</Text>
                </TouchableOpacity>
              )}

              <View style={styles.switchRow}>
                <Text style={styles.label}>Allow multiple choices</Text>
                <Switch
                  value={pollAllowMultiple}
                  onValueChange={setPollAllowMultiple}
                  trackColor={{ false: colors.surfaceAlt, true: colors.pitch700 }}
                  thumbColor={pollAllowMultiple ? colors.pitch400 : colors.inkMuted}
                />
              </View>

              {!!pollError && <Text style={styles.errorText}>{pollError}</Text>}

              <TouchableOpacity
                style={[styles.submitBtn, pollSubmitting && styles.submitBtnDisabled]}
                onPress={submitPoll}
                disabled={pollSubmitting}
              >
                {pollSubmitting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.submitBtnText}>Create Poll</Text>}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Manage group modal */}
      <Modal visible={manageModalOpen} animationType="slide" transparent onRequestClose={() => setManageModalOpen(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <Text style={styles.modalTitle}>{group?.name || 'Group'}</Text>
              <TouchableOpacity onPress={() => setManageModalOpen(false)}>
                <Text style={styles.modalClose}>Close</Text>
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 480 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
              {!!manageError && <Text style={styles.errorText}>{manageError}</Text>}

              {isCreator && (
                <>
                  <Text style={styles.label}>Group name</Text>
                  <View style={styles.optionRow}>
                    <TextInput
                      style={[styles.input, styles.optionInput]}
                      value={renameText}
                      onChangeText={setRenameText}
                      placeholderTextColor={colors.inkMuted}
                    />
                    <TouchableOpacity onPress={handleRename} disabled={savingName} style={styles.smallBtn}>
                      {savingName ? <ActivityIndicator size="small" color={colors.background} /> : <Text style={styles.smallBtnText}>Save</Text>}
                    </TouchableOpacity>
                  </View>
                </>
              )}

              <Text style={styles.sectionTitle}>Members ({group?.members.length ?? 0})</Text>
              {(group?.members || []).map((m) => {
                const id = resolveId(m);
                const isThisCreator = group ? id === resolveId(group.createdBy) : false;
                return (
                  <View key={id} style={styles.memberRow}>
                    <Text style={styles.memberName}>{memberName(m)}{isThisCreator ? ' (Creator)' : ''}</Text>
                    {isCreator && !isThisCreator && (
                      <TouchableOpacity onPress={() => handleRemoveMember(id)} disabled={manageBusyId === id}>
                        <Text style={styles.removeText}>{manageBusyId === id ? 'Removing...' : 'Remove'}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })}

              {isCreator && (
                <>
                  <Text style={styles.sectionTitle}>Add members</Text>
                  {addDirectory === null ? (
                    <ActivityIndicator color={colors.pitch400} style={{ marginTop: 8 }} />
                  ) : addablePlayers.length === 0 ? (
                    <Text style={styles.muted}>Everyone in the directory is already in this group.</Text>
                  ) : (
                    addablePlayers.map((p) => {
                      const uid = resolveId(p.user);
                      const pname = typeof p.user === 'object' && p.user ? p.user.name || 'Player' : 'Player';
                      return (
                        <View key={p._id} style={styles.memberRow}>
                          <Text style={styles.memberName}>{pname}</Text>
                          <TouchableOpacity onPress={() => handleAddMember(uid)} disabled={manageBusyId === uid || !uid}>
                            <Text style={styles.addText}>{manageBusyId === uid ? 'Adding...' : 'Add'}</Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })
                  )}
                </>
              )}

              <View style={styles.dangerZone}>
                {isCreator ? (
                  <TouchableOpacity style={styles.dangerBtn} onPress={handleDeleteGroup} disabled={deleting}>
                    {deleting ? <ActivityIndicator color={colors.wicket400} /> : <Text style={styles.dangerBtnText}>Delete group</Text>}
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity style={styles.dangerBtn} onPress={handleLeaveGroup} disabled={leaving}>
                    {leaving ? <ActivityIndicator color={colors.wicket400} /> : <Text style={styles.dangerBtnText}>Leave group</Text>}
                  </TouchableOpacity>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyContent: { flexGrow: 1 },
  listContent: { padding: 16 },
  muted: { color: colors.inkMuted, fontSize: 13, textAlign: 'center', marginTop: 10 },
  errorText: { color: colors.wicket400, fontSize: 12, textAlign: 'center', paddingVertical: 6 },

  bubbleRow: { flexDirection: 'row', marginBottom: 12 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },
  bubbleWrap: { maxWidth: '80%' },
  bubbleWrapMe: { alignItems: 'flex-end' },
  bubbleWrapThem: { alignItems: 'flex-start' },
  senderName: { color: colors.gold500, fontSize: 11, fontWeight: '700', marginBottom: 3, marginLeft: 4 },

  bubble: { borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleThem: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleMe: { backgroundColor: colors.pitch600, borderBottomRightRadius: 4 },
  bubbleText: { color: colors.ink, fontSize: 14 },
  bubbleTime: { color: colors.inkMuted, fontSize: 10, marginTop: 4, textAlign: 'right' },
  bubbleTimePoll: { color: colors.inkMuted, fontSize: 10, marginTop: 6, textAlign: 'right' },

  attachmentBubble: { padding: 4 },
  attachmentImage: { width: 220, height: 220, borderRadius: 10 },
  videoBubble: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 180 },
  videoText: { color: colors.ink, fontSize: 13, flex: 1 },

  pollCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    padding: 12, minWidth: 220,
  },
  pollQuestion: { color: colors.ink, fontSize: 14, fontWeight: '700', marginBottom: 2 },
  pollHint: { color: colors.inkMuted, fontSize: 11, marginBottom: 8 },
  pollOption: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surfaceAlt,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 10, paddingVertical: 8, marginTop: 8,
  },
  pollOptionSelected: { borderColor: colors.pitch500 },
  pollOptionText: { color: colors.ink, fontSize: 13, flex: 1 },
  pollVoteCount: { color: colors.inkMuted, fontSize: 12, fontWeight: '600' },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 6, padding: 12,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  iconBtn: { width: 36, height: 40, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10, color: colors.ink, fontSize: 14, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.pitch500,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: {
    backgroundColor: colors.surface, borderTopLeftRadius: 18, borderTopRightRadius: 18,
    borderWidth: 1, borderColor: colors.border, paddingBottom: 24, maxHeight: '85%',
  },
  modalHeaderRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  modalTitle: { color: colors.ink, fontSize: 16, fontWeight: 'bold', flex: 1, marginRight: 12 },
  modalClose: { color: colors.pitch400, fontSize: 14, fontWeight: '600' },

  label: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 14 },
  sectionTitle: { color: colors.ink, fontSize: 15, fontWeight: 'bold', marginTop: 20, marginBottom: 4 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
  optionInput: { flex: 1 },
  removeOptionBtn: { padding: 2 },
  addOptionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 },
  addOptionText: { color: colors.pitch400, fontSize: 13, fontWeight: '600' },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surfaceAlt, borderRadius: 10, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 12, paddingVertical: 10, marginTop: 8,
  },
  memberName: { color: colors.ink, fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  removeText: { color: colors.wicket400, fontSize: 12, fontWeight: '600' },
  addText: { color: colors.pitch400, fontSize: 12, fontWeight: '600' },

  smallBtn: { backgroundColor: colors.pitch500, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 11 },
  smallBtnText: { color: colors.background, fontWeight: '700', fontSize: 13 },

  submitBtn: { backgroundColor: colors.pitch500, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 20 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.background, fontWeight: '700', fontSize: 15 },

  dangerZone: { marginTop: 28, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  dangerBtn: { alignItems: 'center', paddingVertical: 10 },
  dangerBtnText: { color: colors.wicket400, fontSize: 14, fontWeight: '700' },
});
