import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, ScrollView, ActivityIndicator, KeyboardAvoidingView, Platform } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';

// Mirrors web-app/app/edtech/new/page.tsx's CATEGORIES/DIFFICULTIES, which mirror
// backend/src/models/Lesson.js's enums exactly.
const CATEGORIES = ['batting', 'bowling', 'fielding', 'fitness', 'rules', 'strategy'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

// Single-choice chip row - same tap-to-select pattern CreateMatchScreen's ChipRow uses, kept
// local here rather than shared since neither screen's version needs to be reused elsewhere
// (see CreateMatchScreen.tsx's own comment on this).
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

export default function CreateLessonScreen({ navigation }: any) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('batting');
  const [difficulty, setDifficulty] = useState('beginner');
  const [content, setContent] = useState('');
  const [tags, setTags] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmit = title.trim().length > 0 && content.trim().length > 0 && !submitting;

  const handleCreate = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    try {
      const tagList = tags.split(',').map((t) => t.trim()).filter(Boolean);
      await api.lessons.createLesson({
        title: title.trim(),
        category,
        difficulty,
        content: content.trim(),
        tags: tagList,
      });
      // There's no per-lesson detail screen on mobile (LearnScreen expands lessons inline
      // instead) - replace back to Learn so it refetches and the new lesson shows up in the
      // list, same "don't leave the submitted form in the back stack" intent as
      // CreateMatchScreen/CreateTeamScreen's navigation.replace to a detail screen.
      navigation.replace('Learn');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create lesson.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.label}>Title</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="e.g. Playing the short ball"
          placeholderTextColor={colors.inkMuted}
        />

        <Text style={styles.label}>Category</Text>
        <ChipRow options={CATEGORIES.map((c) => ({ id: c, label: c }))} value={category} onChange={setCategory} />

        <Text style={styles.label}>Difficulty</Text>
        <ChipRow options={DIFFICULTIES.map((d) => ({ id: d, label: d }))} value={difficulty} onChange={setDifficulty} />

        <Text style={styles.label}>Content</Text>
        <TextInput
          style={[styles.input, styles.textArea]}
          value={content}
          onChangeText={setContent}
          placeholder="Write the lesson content..."
          placeholderTextColor={colors.inkMuted}
          multiline
          numberOfLines={10}
        />

        <Text style={styles.label}>
          Tags <Text style={styles.labelHint}>(optional, comma-separated)</Text>
        </Text>
        <TextInput
          style={styles.input}
          value={tags}
          onChangeText={setTags}
          placeholder="e.g. off-stump, short-of-good-length"
          placeholderTextColor={colors.inkMuted}
          autoCapitalize="none"
        />

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <TouchableOpacity style={[styles.submitBtn, !canSubmit && styles.submitBtnDisabled]} onPress={handleCreate} disabled={!canSubmit}>
          {submitting ? <ActivityIndicator color={colors.background} /> : <Text style={styles.submitBtnText}>Publish Lesson</Text>}
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
  labelHint: { color: colors.inkMuted, fontWeight: '400' },
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
  textArea: { minHeight: 180, textAlignVertical: 'top' },
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
