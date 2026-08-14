import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';

export default function CreateLeagueScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = name.trim().length > 0 && !submitting;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const { league } = await api.leagues.createLeague({
        name: name.trim(),
        description: description.trim() || undefined,
      });
      // Replace rather than push, so backing out of the new league's detail screen returns to
      // the leagues list rather than back to this now-submitted form.
      navigation.replace('LeagueDetail', { leagueId: league._id });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create league.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>League Name</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="e.g. Riverside Cricket League"
          placeholderTextColor={colors.inkMuted}
        />

        <Text style={styles.label}>Description (optional)</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={description}
          onChangeText={setDescription}
          placeholder="A short blurb about the league..."
          placeholderTextColor={colors.inkMuted}
          multiline
          numberOfLines={4}
        />

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={handleCreate} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.submitBtnText}>Create League</Text>}
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
