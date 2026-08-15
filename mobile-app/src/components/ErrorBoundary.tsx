import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { colors } from '../theme';

interface Props {
  children: React.ReactNode;
}

interface State {
  error: Error | null;
  componentStack: string | null;
}

// Catches any uncaught error thrown during render/commit anywhere below it in the tree. React's
// default behavior with no boundary is to unmount everything and render nothing - a silent blank
// screen in a production/published bundle (no LogBox/redbox there, unlike the Metro dev-server
// path, which is why the same underlying bug looks totally different depending on how the app
// was launched). Deliberately renders the real error message + both stacks, not a generic
// message, so a scorer/organizer hitting this in the field can screenshot something actionable.
// Only plain RN primitives and the theme's raw color constants are used here (no react-native-
// paper, no context reads) so the fallback itself can't fail to render even if something further
// up the provider tree (PaperProvider, etc.) is implicated in the crash.
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null, componentStack: null };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null });
    console.error('ErrorBoundary caught an error:', error, info.componentStack);
  }

  handleRetry = () => {
    this.setState({ error: null, componentStack: null });
  };

  render() {
    const { error, componentStack } = this.state;
    if (!error) {
      return this.props.children;
    }

    return (
      <View style={styles.container}>
        <ScrollView contentContainerStyle={styles.content}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{error.message || String(error)}</Text>

          {!!error.stack && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>STACK TRACE</Text>
              <Text style={styles.stack} selectable>{error.stack}</Text>
            </View>
          )}

          {!!componentStack && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>COMPONENT STACK</Text>
              <Text style={styles.stack} selectable>{componentStack}</Text>
            </View>
          )}

          <TouchableOpacity style={styles.retryButton} onPress={this.handleRetry}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  }
}

export default ErrorBoundary;

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingTop: 64, paddingBottom: 40 },
  title: { color: colors.wicket400, fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  message: { color: colors.ink, fontSize: 15, marginBottom: 8 },
  section: { marginTop: 16 },
  sectionLabel: {
    color: colors.inkSecondary,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  stack: {
    color: colors.inkMuted,
    fontSize: 11,
    fontFamily: 'monospace',
    backgroundColor: colors.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 10,
  },
  retryButton: {
    marginTop: 28,
    backgroundColor: colors.pitch500,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  retryButtonText: { color: colors.background, fontSize: 16, fontWeight: '700' },
});
