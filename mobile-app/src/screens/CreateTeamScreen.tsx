import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';

export default function CreateTeamScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = name.trim().length > 0 && city.trim().length > 0 && !submitting;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const { team } = await api.teams.createTeam({
        name: name.trim(),
        city: city.trim(),
        description: description.trim() || undefined,
      });
      // Replace rather than push, so backing out of the new team's detail screen returns
      // to the teams list rather than back to this now-submitted form.
      navigation.replace('TeamDetail', { teamId: team._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team.');
    } finally {
      setSubmitting(false);
    }
  };

  const isProfileError = error.toLowerCase().includes('player profile');

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Team Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Riverside Strikers"
          placeholderTextColor={colors.inkMuted}
        />

        <Text style={styles.label}>City</Text>
        <TextInput
          style={styles.input}
          value={city}
          onChangeText={setCity}
          placeholder="e.g. Bengaluru"
          placeholderTextColor={colors.inkMuted}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="A short blurb about the team..."
          placeholderTextColor={colors.inkMuted}
          multiline
          numberOfLines={4}
        />

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
            {isProfileError && (
              <>
                <Text style={styles.errorHint}>
                  You need a player profile before you can create or captain a team.
                </Text>
                <TouchableOpacity
                  style={styles.errorHintButton}
                  onPress={() =>
                    navigation.navigate('Profile', {
                      screen: 'CompleteProfile',
                      params: { redirectTab: 'Teams', redirectScreen: 'CreateTeam' },
                    })
                  }
                >
                  <Text style={styles.errorHintButtonText}>Complete your player profile</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        )}

        <TouchableOpacity style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={handleCreate} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.submitBtnText}>Create Team</Text>}
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
  errorBox: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.wicket500,
    padding: 12,
    marginTop: 20,
  },
  errorText: { color: colors.wicket400, fontSize: 13, fontWeight: '600' },
  errorHint: { color: colors.inkSecondary, fontSize: 12, marginTop: 6, lineHeight: 17 },
  errorHintButton: {
    marginTop: 10,
    backgroundColor: colors.pitch900,
    borderWidth: 1,
    borderColor: colors.pitch500,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  errorHintButtonText: { color: colors.pitch400, fontSize: 13, fontWeight: '700' },
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
