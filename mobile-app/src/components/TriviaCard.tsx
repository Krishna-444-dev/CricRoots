// "Trivia of the day" community-feed card (CricHeroes-style) - mirrors web-app's
// components/community/TriviaCard.tsx. A single rotating cricket-knowledge question,
// global/app-wide (not scoped to a team/tournament). The correct answer/explanation are
// deliberately withheld by the backend until this viewer has actually answered - see
// triviaController.js's getCurrentTrivia - so the reveal state here comes straight from the
// server response, never computed client-side.
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { CurrentTrivia } from '../shared/types';
import { useAuth } from '../hooks/useAuth';

export default function TriviaCard() {
  const { user } = useAuth();
  const [trivia, setTrivia] = useState<CurrentTrivia | null | undefined>(undefined);
  const [answering, setAnswering] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.trivia
      .getCurrent()
      .then(({ trivia }) => setTrivia(trivia))
      .catch(() => setTrivia(null));
  }, []);

  const handleAnswer = async (optionIndex: number) => {
    if (!trivia || answering) return;
    setAnswering(true);
    setError('');
    try {
      const { correct, correctIndex, explanation } = await api.trivia.answer(trivia._id, optionIndex);
      setTrivia((prev) => (prev ? { ...prev, correctIndex, explanation, myAnswer: { optionIndex, correct } } : prev));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not submit your answer');
    } finally {
      setAnswering(false);
    }
  };

  if (trivia === undefined) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={colors.pitch400} />
      </View>
    );
  }
  if (trivia === null) {
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>No trivia available right now - check back soon.</Text>
      </View>
    );
  }

  const revealed = trivia.myAnswer !== null;

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>🏏 Trivia of the Day</Text>
        {revealed && (
          <View style={[styles.resultBadge, trivia.myAnswer!.correct ? styles.resultBadgeCorrect : styles.resultBadgeWrong]}>
            <Text style={[styles.resultBadgeText, trivia.myAnswer!.correct ? styles.resultTextCorrect : styles.resultTextWrong]}>
              {trivia.myAnswer!.correct ? 'Correct!' : 'Not quite'}
            </Text>
          </View>
        )}
      </View>
      <Text style={styles.question}>{trivia.question}</Text>
      {!!error && <Text style={styles.errorText}>{error}</Text>}
      {trivia.options.map((opt, index) => {
        const isCorrectOption = revealed && trivia.correctIndex === index;
        const isMyWrongPick = revealed && trivia.myAnswer!.optionIndex === index && !trivia.myAnswer!.correct;
        return (
          <TouchableOpacity
            key={index}
            disabled={revealed || !user || answering}
            onPress={() => handleAnswer(index)}
            style={[
              styles.optionRow,
              isCorrectOption && styles.optionRowCorrect,
              isMyWrongPick && styles.optionRowWrong,
            ]}
          >
            <Text style={styles.optionText}>
              {opt}
              {isCorrectOption ? ' ✓' : ''}
              {isMyWrongPick ? ' ✕' : ''}
            </Text>
          </TouchableOpacity>
        );
      })}
      {revealed && !!trivia.explanation && <Text style={styles.explanation}>{trivia.explanation}</Text>}
      {!revealed && !user && <Text style={styles.loginHint}>Log in to answer.</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14,
    padding: 16,
  },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  title: { color: colors.ink, fontSize: 16, fontWeight: 'bold' },
  resultBadge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1 },
  resultBadgeCorrect: { backgroundColor: colors.pitch900, borderColor: colors.pitch500 },
  resultBadgeWrong: { backgroundColor: '#2A1414', borderColor: colors.wicket500 },
  resultBadgeText: { fontSize: 11, fontWeight: '700' },
  resultTextCorrect: { color: colors.pitch400 },
  resultTextWrong: { color: colors.wicket400 },
  question: { color: colors.ink, fontSize: 15, fontWeight: '600', marginBottom: 12 },
  errorText: { color: colors.wicket400, fontSize: 12, marginBottom: 8 },
  optionRow: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10,
    marginBottom: 8,
  },
  optionRowCorrect: { borderColor: colors.pitch500, backgroundColor: colors.pitch900 },
  optionRowWrong: { borderColor: colors.wicket500, backgroundColor: '#2A1414' },
  optionText: { color: colors.ink, fontSize: 13 },
  explanation: { color: colors.inkSecondary, fontSize: 13, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: colors.border, lineHeight: 18 },
  loginHint: { color: colors.inkMuted, fontSize: 11, marginTop: 4 },
  muted: { color: colors.inkSecondary, fontSize: 13, textAlign: 'center' },
});
