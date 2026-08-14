import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { League } from '../shared/types';

const FORMATS = ['League', 'Knockout', 'Group', 'Round-Robin'] as const;
const MATCH_TYPES = ['T20', 'T10', 'ODI', 'Test'] as const;

// Single-choice chip row - same tap-to-select pattern CreateMatchScreen's ChipRow uses, kept
// local here for the same reason (this screen only needs a light single-row version).
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

export default function CreateTournamentScreen({ navigation, route }: any) {
  // Arriving from a league's "Create Tournament" action pre-selects that league (see
  // LeagueDetailScreen) - still just a normal optional field otherwise.
  const preselectedLeagueId: string | undefined = route?.params?.leagueId;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [format, setFormat] = useState<(typeof FORMATS)[number]>('League');
  const [matchType, setMatchType] = useState<(typeof MATCH_TYPES)[number]>('T20');
  const [venue, setVenue] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [registrationDeadline, setRegistrationDeadline] = useState('');
  const [maxTeams, setMaxTeams] = useState('');
  const [leagueId, setLeagueId] = useState(preselectedLeagueId || '');
  const [leagues, setLeagues] = useState<League[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.leagues
      .getLeagues()
      .then(({ leagues }) => setLeagues(leagues))
      .catch(() => setLeagues([]));
  }, []);

  const canSubmit =
    name.trim().length > 0 &&
    venue.trim().length > 0 &&
    startDate.trim().length > 0 &&
    endDate.trim().length > 0 &&
    registrationDeadline.trim().length > 0 &&
    !submitting;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      // Dates are free-typed (no native date picker in scope - same approach
      // CreateMatchScreen took for scheduledDate); the backend just needs anything
      // `new Date()` can parse.
      const parsedStart = new Date(startDate);
      const parsedEnd = new Date(endDate);
      const parsedDeadline = new Date(registrationDeadline);
      if (isNaN(parsedStart.getTime()) || isNaN(parsedEnd.getTime()) || isNaN(parsedDeadline.getTime())) {
        setError('Enter valid dates, e.g. 2026-08-20');
        setSubmitting(false);
        return;
      }
      const { tournament } = await api.tournaments.createTournament({
        name: name.trim(),
        description: description.trim() || undefined,
        format,
        matchType,
        venue: venue.trim(),
        startDate: parsedStart.toISOString(),
        endDate: parsedEnd.toISOString(),
        registrationDeadline: parsedDeadline.toISOString(),
        maxTeams: maxTeams.trim() ? Number(maxTeams.trim()) : undefined,
        leagueId: leagueId || undefined,
      });
      // Replace rather than push, so backing out of the new tournament's detail screen
      // returns to the tournaments list rather than back to this now-submitted form.
      navigation.replace('TournamentDetail', { tournamentId: tournament._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tournament.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Tournament Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Riverside Premier League"
          placeholderTextColor={colors.inkMuted}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="A short blurb about the tournament..."
          placeholderTextColor={colors.inkMuted}
          multiline
          numberOfLines={4}
        />

        <Text style={styles.label}>Format</Text>
        <ChipRow options={FORMATS.map((f) => ({ id: f, label: f }))} value={format} onChange={(v) => setFormat(v as (typeof FORMATS)[number])} />

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

        <Text style={styles.label}>Start Date</Text>
        <TextInput
          style={styles.input}
          value={startDate}
          onChangeText={setStartDate}
          placeholder="2026-08-20"
          placeholderTextColor={colors.inkMuted}
        />

        <Text style={styles.label}>End Date</Text>
        <TextInput
          style={styles.input}
          value={endDate}
          onChangeText={setEndDate}
          placeholder="2026-09-10"
          placeholderTextColor={colors.inkMuted}
        />

        <Text style={styles.label}>Registration Deadline</Text>
        <TextInput
          style={styles.input}
          value={registrationDeadline}
          onChangeText={setRegistrationDeadline}
          placeholder="2026-08-15"
          placeholderTextColor={colors.inkMuted}
        />

        <Text style={styles.label}>Max Teams (optional)</Text>
        <TextInput
          style={styles.input}
          value={maxTeams}
          onChangeText={setMaxTeams}
          placeholder="8"
          placeholderTextColor={colors.inkMuted}
          keyboardType="number-pad"
        />

        {leagues.length > 0 && (
          <>
            <Text style={styles.label}>League (optional)</Text>
            <ChipRow
              options={[{ id: '', label: 'None' }, ...leagues.map((l) => ({ id: l._id, label: l.name }))]}
              value={leagueId}
              onChange={setLeagueId}
            />
          </>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={handleCreate} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.submitBtnText}>Create Tournament</Text>}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 40 },
  label: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 16 },
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
  textArea: { minHeight: 90, textAlignVertical: 'top' },
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
