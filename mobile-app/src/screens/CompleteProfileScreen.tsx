// Standalone player-profile completion for an EXISTING logged-in user - mirrors
// web-app/app/players/complete-profile/page.tsx. A "Player" document (specialization, batting
// style, bowling style) is a separate thing from the "User" account created at signup
// (RegisterScreen.tsx only collects name/email/phone/password). Without a Player doc a user
// can't be rostered to a team, can't appear in Network, and can't get PlayerStats - this is the
// only place on mobile that creates one, reachable from ProfileScreen's "no player profile yet"
// case and CreateTeamScreen's "player profile required" error.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';

const SPECIALIZATIONS = ['Batsman', 'Bowler', 'All-rounder', 'Wicket-keeper'];
const BATTING_STYLES = ['Right-hand', 'Left-hand'];
const BOWLING_STYLES = ['None', 'Right-arm Fast', 'Right-arm Spin', 'Left-arm Fast', 'Left-arm Spin'];

// Tap-to-select chip row - same small local pattern CreateMatchScreen.tsx uses for its own
// single-choice fields; each screen keeps its own copy rather than sharing one component.
function ChipRow({
  options,
  value,
  onChange,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <View style={styles.chipRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt}
          style={[styles.chip, value === opt && styles.chipSelected]}
          onPress={() => onChange(opt)}
        >
          <Text style={[styles.chipText, value === opt && styles.chipTextSelected]}>{opt}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

// Params double as a lightweight equivalent of web's `?redirect=` query param, since React
// Navigation doesn't have query strings: callers that need the user routed somewhere specific
// after completing their profile (rather than just "go back") pass one of these. Both current
// call sites are covered: ProfileScreen wants straight to the player's own new stats page,
// CreateTeamScreen wants back to the form it dead-ended on (in a different tab's stack).
export type CompleteProfileParams = {
  onSuccessGoToStats?: boolean;
  redirectTab?: string;
  redirectScreen?: string;
  redirectParams?: any;
};

export default function CompleteProfileScreen({ navigation, route }: any) {
  const params: CompleteProfileParams = route?.params ?? {};

  const [checking, setChecking] = useState(true);
  const [alreadyHasProfile, setAlreadyHasProfile] = useState(false);
  const [existingPlayerId, setExistingPlayerId] = useState<string | null>(null);

  const [specialization, setSpecialization] = useState('');
  const [battingStyle, setBattingStyle] = useState('');
  const [bowlingStyle, setBowlingStyle] = useState('None');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.players.getMyProfile()
      .then(({ player }) => {
        setAlreadyHasProfile(true);
        setExistingPlayerId(player?._id ?? null);
      })
      .catch(() => setAlreadyHasProfile(false))
      .finally(() => setChecking(false));
  }, []);

  const goToDestination = (playerId?: string | null) => {
    if (params.onSuccessGoToStats && playerId) {
      navigation.replace('PlayerStats', { playerId });
    } else if (params.redirectTab && params.redirectScreen) {
      navigation.navigate(params.redirectTab, { screen: params.redirectScreen, params: params.redirectParams });
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    } else {
      navigation.navigate('ProfileMain');
    }
  };

  const canSubmit = !!specialization && !!battingStyle && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const { player } = await api.players.register({ specialization, battingStyle, bowlingStyle });
      goToDestination(player?._id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create your player profile.');
    } finally {
      setSubmitting(false);
    }
  };

  if (checking) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.pitch400} size="large" />
      </View>
    );
  }

  if (alreadyHasProfile) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>You already have a player profile set up.</Text>
        <TouchableOpacity style={styles.submitBtn} onPress={() => goToDestination(existingPlayerId)}>
          <Text style={styles.submitBtnText}>Continue</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Complete Your Player Profile</Text>
        <Text style={styles.subtitle}>
          A few cricket details needed before you can create a team, join a match, or show up in career stats.
        </Text>

        <Text style={styles.label}>Specialization</Text>
        <ChipRow options={SPECIALIZATIONS} value={specialization} onChange={setSpecialization} />

        <Text style={styles.label}>Batting Style</Text>
        <ChipRow options={BATTING_STYLES} value={battingStyle} onChange={setBattingStyle} />

        <Text style={styles.label}>Bowling Style</Text>
        <ChipRow options={BOWLING_STYLES} value={bowlingStyle} onChange={setBowlingStyle} />

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={handleSubmit} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.submitBtnText}>Complete Profile</Text>}
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
  title: { color: colors.ink, fontSize: 20, fontWeight: 'bold', marginBottom: 6 },
  subtitle: { color: colors.inkSecondary, fontSize: 13, lineHeight: 18, marginBottom: 8 },
  label: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600', marginBottom: 6, marginTop: 16 },
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
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 28,
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitBtnText: { color: colors.background, fontWeight: '700', fontSize: 15 },
});
