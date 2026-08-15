// Reusable community-feed polls list, scoped to exactly one team or tournament - shared by
// TeamDetailScreen, TournamentDetailScreen, and CommunityScreen, so all three read and behave
// identically rather than each growing its own copy (mirrors web-app's
// components/community/PollsSection.tsx, same props/behavior, native styling). `canManage`
// gates poll creation and early-close - the caller computes it the same way every other
// admin/organizer check in this app does (team captain/vice-captain/coach, or tournament
// organizer), never re-derived here.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, TextInput, ActivityIndicator } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { Poll } from '../shared/types';
import { useAuth } from '../hooks/useAuth';

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

interface Props {
  scope: 'team' | 'tournament';
  scopeId: string;
  canManage: boolean;
}

export default function PollsSection({ scope, scopeId, canManage }: Props) {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [error, setError] = useState('');
  const [votingId, setVotingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const load = useCallback(() => {
    const fetcher = scope === 'team' ? api.polls.getForTeam(scopeId) : api.polls.getForTournament(scopeId);
    fetcher
      .then(({ polls }) => setPolls(polls))
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load polls'));
  }, [scope, scopeId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVote = async (pollId: string, optionIndex: number) => {
    setVotingId(pollId);
    setError('');
    try {
      const { poll } = await api.polls.vote(pollId, optionIndex);
      setPolls((prev) => (prev ? prev.map((p) => (p._id === pollId ? poll : p)) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record your vote');
    } finally {
      setVotingId(null);
    }
  };

  const handleClose = async (pollId: string) => {
    setClosingId(pollId);
    setError('');
    try {
      const { poll } = await api.polls.close(pollId);
      setPolls((prev) => (prev ? prev.map((p) => (p._id === pollId ? poll : p)) : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not close this poll');
    } finally {
      setClosingId(null);
    }
  };

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };
  const addOption = () => setOptions((prev) => (prev.length < MAX_OPTIONS ? [...prev, ''] : prev));
  const removeOption = (index: number) =>
    setOptions((prev) => (prev.length > MIN_OPTIONS ? prev.filter((_, i) => i !== index) : prev));

  const handleCreate = async () => {
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < MIN_OPTIONS) return;
    setCreating(true);
    setCreateError('');
    try {
      const { poll } = await api.polls.create({
        question: question.trim(),
        options: cleanOptions,
        ...(scope === 'team' ? { teamId: scopeId } : { tournamentId: scopeId }),
      });
      setPolls((prev) => (prev ? [poll, ...prev] : [poll]));
      setQuestion('');
      setOptions(['', '']);
      setShowCreate(false);
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Could not create poll');
    } finally {
      setCreating(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Polls</Text>
        {canManage && !showCreate && (
          <TouchableOpacity style={styles.newPollBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.newPollBtnText}>+ New Poll</Text>
          </TouchableOpacity>
        )}
      </View>

      {!!error && <Text style={styles.errorText}>{error}</Text>}

      {canManage && showCreate && (
        <View style={styles.createCard}>
          {!!createError && <Text style={styles.errorText}>{createError}</Text>}
          <TextInput
            style={styles.input}
            value={question}
            onChangeText={setQuestion}
            placeholder="Ask a question..."
            placeholderTextColor={colors.inkMuted}
          />
          {options.map((opt, i) => (
            <View key={i} style={styles.optionInputRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={opt}
                onChangeText={(v) => updateOption(i, v)}
                placeholder={`Option ${i + 1}`}
                placeholderTextColor={colors.inkMuted}
              />
              {options.length > MIN_OPTIONS && (
                <TouchableOpacity onPress={() => removeOption(i)} style={styles.removeOptionBtn}>
                  <Text style={styles.removeOptionText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <View style={styles.createActionsRow}>
            {options.length < MAX_OPTIONS ? (
              <TouchableOpacity onPress={addOption}>
                <Text style={styles.addOptionText}>+ Add option</Text>
              </TouchableOpacity>
            ) : (
              <View />
            )}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowCreate(false);
                  setCreateError('');
                }}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (creating || !question.trim() || options.filter((o) => o.trim()).length < MIN_OPTIONS) && styles.submitBtnDisabled]}
                onPress={handleCreate}
                disabled={creating || !question.trim() || options.filter((o) => o.trim()).length < MIN_OPTIONS}
              >
                <Text style={styles.submitBtnText}>{creating ? 'Creating...' : 'Create Poll'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {polls === null ? (
        <ActivityIndicator color={colors.pitch400} style={{ marginVertical: 12 }} />
      ) : polls.length === 0 ? (
        <Text style={styles.muted}>No polls yet.{canManage ? ' Create one to hear from the team.' : ''}</Text>
      ) : (
        polls.map((poll) => {
          const isPollCreator = !!user?.id && !!poll.createdBy && user.id === poll.createdBy;
          return (
            <View key={poll._id} style={styles.pollCard}>
              <View style={styles.pollHeaderRow}>
                <Text style={styles.pollQuestion}>{poll.question}</Text>
                {!poll.isOpen && (
                  <View style={styles.closedBadge}>
                    <Text style={styles.closedBadgeText}>Closed</Text>
                  </View>
                )}
              </View>
              {poll.options.map((opt, index) => {
                const isMine = poll.myOptionIndex === index;
                const disabled = !poll.isOpen || !user || votingId === poll._id;
                return (
                  <TouchableOpacity
                    key={index}
                    disabled={disabled}
                    onPress={() => handleVote(poll._id, index)}
                    style={[styles.optionRow, isMine && styles.optionRowMine]}
                  >
                    <View style={styles.optionTextRow}>
                      <Text style={styles.optionText}>
                        {opt.text}
                        {isMine ? '  (your vote)' : ''}
                      </Text>
                      <Text style={styles.optionMeta}>{opt.percentage}% · {opt.voteCount}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, isMine && styles.barFillMine, { width: `${opt.percentage}%` }]} />
                    </View>
                  </TouchableOpacity>
                );
              })}
              <View style={styles.pollFooterRow}>
                <Text style={styles.voteCountText}>{poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'}</Text>
                {poll.isOpen && (canManage || isPollCreator) && (
                  <TouchableOpacity onPress={() => handleClose(poll._id)} disabled={closingId === poll._id}>
                    <Text style={styles.closePollText}>{closingId === poll._id ? 'Closing...' : 'Close poll'}</Text>
                  </TouchableOpacity>
                )}
              </View>
              {!user && poll.isOpen && <Text style={styles.loginHint}>Log in to vote.</Text>}
            </View>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 4 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
  newPollBtn: { backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.borderStrong, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 6 },
  newPollBtnText: { color: colors.ink, fontWeight: '700', fontSize: 12 },
  errorText: { color: colors.wicket400, fontSize: 12, marginBottom: 8 },
  muted: { color: colors.inkSecondary, fontSize: 13 },
  createCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 12, marginBottom: 12,
  },
  input: {
    backgroundColor: colors.surfaceAlt, borderRadius: 8, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 10, paddingVertical: 8, color: colors.ink, fontSize: 13, marginBottom: 8,
  },
  optionInputRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  removeOptionBtn: { padding: 6 },
  removeOptionText: { color: colors.inkMuted, fontSize: 14 },
  createActionsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  addOptionText: { color: colors.pitch400, fontSize: 13, fontWeight: '600' },
  cancelBtn: { paddingHorizontal: 12, paddingVertical: 8 },
  cancelBtnText: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600' },
  submitBtn: { backgroundColor: colors.pitch500, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.background, fontWeight: '700', fontSize: 13 },
  pollCard: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    padding: 12, marginBottom: 10,
  },
  pollHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  pollQuestion: { color: colors.ink, fontSize: 14, fontWeight: '600', flex: 1, marginRight: 8 },
  closedBadge: { backgroundColor: colors.surfaceAlt, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 3 },
  closedBadgeText: { color: colors.inkSecondary, fontSize: 10, fontWeight: '700' },
  optionRow: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8,
    marginBottom: 6,
  },
  optionRowMine: { borderColor: colors.pitch500, backgroundColor: colors.pitch900 },
  optionTextRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  optionText: { color: colors.ink, fontSize: 13 },
  optionMeta: { color: colors.inkSecondary, fontSize: 12 },
  barTrack: { height: 5, borderRadius: 999, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 999, backgroundColor: colors.borderStrong },
  barFillMine: { backgroundColor: colors.pitch400 },
  pollFooterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 },
  voteCountText: { color: colors.inkMuted, fontSize: 11 },
  closePollText: { color: colors.inkMuted, fontSize: 11, fontWeight: '600' },
  loginHint: { color: colors.inkMuted, fontSize: 11, marginTop: 6 },
});
