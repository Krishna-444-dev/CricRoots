// Loading screen for the mobile application
import React from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { Text } from 'react-native-paper';
import { colors } from '../theme';

const LoadingScreen = () => {
  return (
    <View style={styles.container}>
      <Text style={styles.logoText}>CricRoots</Text>
      <ActivityIndicator size="large" color={colors.primary} style={styles.spinner} />
      <Text style={styles.loadingText}>Loading...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  logoText: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
    marginBottom: 24,
  },
  spinner: {
    marginBottom: 16,
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
});

export default LoadingScreen;
