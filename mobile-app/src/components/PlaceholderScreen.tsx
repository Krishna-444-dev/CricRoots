// Temporary placeholder for screens not yet built out. Replace the body of this component
// (or the screen file importing it) with the real implementation - this exists so the
// navigator always has a valid, non-crashing route to point at while screens are built
// incrementally.
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function PlaceholderScreen({ title, note }: { title: string; note?: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.note}>{note || 'Coming soon.'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.ink,
    marginBottom: 8,
  },
  note: {
    fontSize: 14,
    color: colors.inkSecondary,
    textAlign: 'center',
  },
});
