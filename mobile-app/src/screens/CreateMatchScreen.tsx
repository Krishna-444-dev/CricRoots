import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { Team, Tournament } from '../shared/types';

const MATCH_TYPES = ['T20', 'ODI', 'Test', 'Friendly'] as const;
const PITCH_TYPES = [
  { id: 'unknown', label: 'Unknown' },
  { id: 'dry', label: 'Dry' },
  { id: 'green', label: 'Green' },
  { id: 'flat', label: 'Flat' },
  { id: 'dusty', label: 'Dusty' },
];

// Single-choice chip row - same tap-to-select pattern LiveScoringScreen's ChipGroup uses,
// kept local here rather than shared since this screen only needs a light single-row version
// (no required/empty-label variants).
function ChipRow({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.id}
          style={[styles.chip, value === opt.id && styles.chipSelected]}
          onPress={() => onChange(opt.id)}
        >
          <Text style={[styles.chipText, value === opt.id && styles.chipTextSelected]}>{opt.label}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function TeamPicker({
  label,
  teams,
  selectedId,
  onSelect,
  excludeId,
}: {
  label: string;
  teams: Team[];
  selectedId: string;
  onSelect: (id: string) => void;
  excludeId?: string;
}) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.teamList}>
        {teams
          .filter((t) => t._id !== excludeId)
          .map((t) => (
            <TouchableOpacity
              key={t._id}
              style={[styles.teamRow, selectedId === t._id && styles.teamRowSelected]}
              onPress={() => onSelect(t._id)}
            >
              <Text style={[styles.teamRowText, selectedId === t._id && styles.teamRowTextSelected]}>{t.name}</Text>
            </TouchableOpacity>
          ))}
      </View>
    </View>
  );
}

export default function CreateMatchScreen({ navigation }: any) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loadingOptions, setLoadingOptions] = useState(true);

  const [title, setTitle] = useState('');
  const [team1Id, setTeam1Id] = useState('');
  const [team2Id, setTeam2Id] = useState('');
  const [tournamentId, setTournamentId] = useState('');
  const [matchType, setMatchType] = useState<(typeof MATCH_TYPES)[number]>('T20');
  const [pitchType, setPitchType] = useState('unknown');
  const [venue, setVenue] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.teams.getTeams(), api.tournaments.getTournaments()])
      .then(([teamsRes, tournamentsRes]) => {
        setTeams(teamsRes.teams);
        // Only tournaments still open to new fixtures - matches web-app/app/matches/new/page.tsx.
        setTournaments((tournamentsRes.tournaments as Tournament[]).filter((t) => ['Registration', 'Ongoing'].includes(t.status)));
      })
      .catch(() => {})
      .finally(() => setLoadingOptions(false));
  }, []);

  const canSubmit =
    title.trim().length > 0 &&
    !!team1Id &&
    !!team2Id &&
    team1Id !== team2Id &&
    venue.trim().length > 0 &&
    scheduledDate.trim().length > 0 &&
    !submitting;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      // scheduledDate is free-typed (no native date picker in scope - see comment on the
      // TextInput below); the backend just needs anything `new Date()` can parse.
      const parsedDate = new Date(scheduledDate);
      if (isNaN(parsedDate.getTime())) {
        setError('Enter a valid date, e.g. 2026-08-20 18:00');
        setSubmitting(false);
        return;
      }
      const { match } = await api.matches.createMatch({
        title: title.trim(),
        team1Id,
        team2Id,
        matchType,
        venue: venue.trim(),
        pitchType,
        scheduledDate: parsedDate.toISOString(),
        tournamentId: tournamentId || undefined,
      });
      // Replace rather than push, so backing out of the new match's detail screen returns to
      // the matches list rather than back to this now-submitted form.
      navigation.replace('MatchDetail', { matchId: match._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create match.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingOptions) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.pitch400} />
      </View>
    );
  }

  if (teams.length < 2) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>You need at least two teams before creating a match.</Text>
        <TouchableOpacity style={styles.submitBtn} onPress={() => navigation.navigate('Teams', { screen: 'CreateTeam' })}>
          <Text style={styles.submitBtnText}>Create a Team</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Riverside Strikers vs City XI"
          placeholderTextColor={colors.inkMuted}
        />

        <TeamPicker label="Team 1" teams={teams} selectedId={team1Id} onSelect={setTeam1Id} excludeId={team2Id} />
        <TeamPicker label="Team 2" teams={teams} selectedId={team2Id} onSelect={setTeam2Id} excludeId={team1Id} />

        <Text style={styles.label}>Match Type</Text>
        <ChipRow options={MATCH_TYPES.map((t) => ({ id: t, label: t }))} value={matchType} onChange={(v) => setMatchType(v as (typeof MATCH_TYPES)[number])} />

        <Text style={styles.label}>Venue</Text>
        <TextInput
          style={styles.input}
          value={venue}
          onChangeText={setVenue}
          placeholder="e.g. Riverside Ground"
          placeholderTextColor={colors.inkMuted}
        />

        <Text style={styles.label}>Pitch Type (if known)</Text>
        <ChipRow options={PITCH_TYPES} value={pitchType} onChange={setPitchType} />

        <Text style={styles.label}>Date &amp; Time</Text>
        <TextInput
          style={styles.input}
          value={scheduledDate}
          onChangeText={setScheduledDate}
          placeholder="2026-08-20 18:00"
          placeholderTextColor={colors.inkMuted}
        />

        {tournaments.length > 0 && (
          <>
            <Text style={styles.label}>Tournament (optional)</Text>
            <View style={styles.teamList}>
              <TouchableOpacity
                style={[styles.teamRow, tournamentId === '' && styles.teamRowSelected]}
                onPress={() => setTournamentId('')}
              >
                <Text style={[styles.teamRowText, tournamentId === '' && styles.teamRowTextSelected]}>Not part of a tournament</Text>
              </TouchableOpacity>
              {tournaments.map((t) => (
                <TouchableOpacity
                  key={t._id}
                  style={[styles.teamRow, tournamentId === t._id && styles.teamRowSelected]}
                  onPress={() => setTournamentId(t._id)}
                >
                  <Text style={[styles.teamRowText, tournamentId === t._id && styles.teamRowTextSelected]}>{t.name}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text style={styles.hint}>Linking a match to a tournament updates its points table when the match is completed.</Text>
          </>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={handleCreate} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.submitBtnText}>Create Match</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: colors.background },
  muted: { color: colors.inkMuted, textAlign: 'center', fontSize: 13, lineHeight: 18, marginBottom: 20 },
  label: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 16 },
  hint: { color: colors.inkMuted, fontSize: 12, marginTop: 6, lineHeight: 16 },
  input: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: colors.ink,
    fontSize: 15,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: { backgroundColor: colors.pitch900, borderColor: colors.pitch500 },
  chipText: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: colors.pitch400 },
  teamList: { gap: 8 },
  teamRow: {
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  teamRowSelected: { backgroundColor: colors.pitch900, borderColor: colors.pitch500 },
  teamRowText: { color: colors.inkSecondary, fontSize: 14, fontWeight: '600' },
  teamRowTextSelected: { color: colors.pitch400 },
  errorBox: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.wicket500,
    padding: 12,
    marginTop: 20,
  },
  errorText: { color: colors.wicket400, fontSize: 13, fontWeight: '600' },
  submitBtn: {
    backgroundColor: colors.pitch500,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
