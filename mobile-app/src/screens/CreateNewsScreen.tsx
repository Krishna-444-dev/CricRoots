import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { useAuth } from '../hooks/useAuth';

// Mirrors web-app/app/news/new/page.tsx's CATEGORIES - deliberately a subset of
// backend/src/models/NewsPost.js's full enum: 'match-report' is auto-generated (see
// services/matchArticleGenerator.js) and 'international' is an unpopulated placeholder for a
// future curated feed, so neither belongs in a manual authoring form.
const CATEGORIES = ['general', 'tournament-update', 'club-news', 'tips'];

const ALLOWED_ROLES = ['organizer', 'admin'];

// Single-choice chip row - same tap-to-select pattern CreateMatchScreen's ChipRow uses, kept
// local here rather than shared (see that screen's comment on why this isn't a shared component).
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

export default function CreateNewsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('general');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = title.trim().length > 0 && body.trim().length > 0 && !submitting;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      await api.news.createPost({ title: title.trim(), category, body: body.trim() });
      // There's no per-post detail screen on mobile (NewsScreen expands posts inline instead) -
      // replace back to News so it refetches and the new post shows up in the list, same
      // "don't leave the submitted form in the back stack" intent as
      // CreateMatchScreen/CreateTeamScreen's navigation.replace to a detail screen.
      navigation.replace('News');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create post.');
    } finally {
      setSubmitting(false);
    }
  };

  // Same server-side gate as newsController.createNewsPost's ALLOWED_ROLES - checked here too
  // so non-organizers see an explanation instead of a form they'd only get a 403 from.
  if (!user || !ALLOWED_ROLES.includes(user.role)) {
    return (
      <View style={styles.centered}>
        <Text style={styles.muted}>Only organizers and admins can publish news posts.</Text>
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
          placeholder="e.g. Riverside Strikers clinch the title"
          placeholderTextColor={colors.inkMuted}
        />

        <Text style={styles.label}>Category</Text>
        <ChipRow options={CATEGORIES.map((c) => ({ id: c, label: c }))} value={category} onChange={setCategory} />

        <Text style={styles.label}>Body</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={body}
          onChangeText={setBody}
          placeholder="Write the post..."
          placeholderTextColor={colors.inkMuted}
          multiline
          numberOfLines={8}
        />

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={handleCreate} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.submitBtnText}>Publish Post</Text>}
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
  muted: { color: colors.inkMuted, textAlign: 'center', fontSize: 13, lineHeight: 18 },
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
  textArea: { minHeight: 150, textAlignVertical: 'top' },
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
  chipText: { color: colors.inkSecondary, fontSize: 13, fontWeight: '600', textTransform: 'capitalize' },
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
