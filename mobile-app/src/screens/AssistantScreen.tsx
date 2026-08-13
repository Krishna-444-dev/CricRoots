// In-app assistant - app-help and cricket-rules Q&A, grounded in real reference content
// (backend/src/services/assistantService.js). Mirrors web-app's AssistantWidget philosophy: check
// /assistant/status once on mount and only show a chat UI when the backend actually has an
// Anthropic API key configured, rather than presenting a chat box that will just reply "not set
// up yet" to everything. Unlike web (a global floating bubble), this is a dedicated screen, which
// fits mobile navigation better - reached from the Profile tab.
//
// Conversation state is local component state only, lost on navigating away - the client owns
// history (last ~10 turns sent back with each request), there's no server-side chat session
// storage to restore from anyway.
import React, { useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

const HISTORY_TURNS = 10;

export default function AssistantScreen() {
  const [checkingStatus, setCheckingStatus] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const listRef = useRef<FlatList>(null);

  // Checked on every focus (not just first mount) so returning to this tab after an admin
  // configures the API key picks it up without needing an app restart - same convention as
  // ProfileScreen's unread-count refetch.
  useFocusEffect(
    React.useCallback(() => {
      let cancelled = false;
      setCheckingStatus(true);
      api.assistant.getStatus()
        .then(({ configured: isConfigured }) => { if (!cancelled) setConfigured(isConfigured); })
        .catch((e) => { if (!cancelled) setStatusError(e instanceof Error ? e.message : 'Could not reach the assistant'); })
        .finally(() => { if (!cancelled) setCheckingStatus(false); });
      return () => { cancelled = true; };
    }, [])
  );

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;

    const history = messages.slice(-HISTORY_TURNS);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setSending(true);
    setError(null);

    try {
      const { reply } = await api.assistant.ask(text, history);
      setMessages((prev) => [...prev, { role: 'assistant', content: reply }]);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not reach the assistant');
    } finally {
      setSending(false);
    }
  };

  if (checkingStatus) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.pitch400} size="large" />
      </View>
    );
  }

  if (!configured) {
    return (
      <View style={styles.centered}>
        <Ionicons name="chatbubble-ellipses-outline" size={32} color={colors.inkMuted} />
        <Text style={styles.notConfiguredTitle}>Assistant not set up yet</Text>
        <Text style={styles.muted}>
          {statusError || "The in-app assistant isn't configured for this server yet. Check back later."}
        </Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <FlatList
        ref={listRef}
        style={styles.list}
        data={messages}
        keyExtractor={(_, i) => String(i)}
        contentContainerStyle={messages.length === 0 ? styles.emptyContent : styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="sparkles-outline" size={28} color={colors.inkMuted} />
            <Text style={styles.muted}>
              Ask how to use a feature, or a cricket rules question - I&apos;ll answer from what&apos;s
              actually in the app, not guess.
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={[styles.bubbleRow, item.role === 'user' ? styles.bubbleRowMe : styles.bubbleRowThem]}>
            <View style={[styles.bubble, item.role === 'user' ? styles.bubbleMe : styles.bubbleThem]}>
              <Text style={[styles.bubbleText, item.role === 'user' && styles.bubbleTextMe]}>{item.content}</Text>
            </View>
          </View>
        )}
        ListFooterComponent={
          sending ? (
            <View style={[styles.bubbleRow, styles.bubbleRowThem]}>
              <View style={[styles.bubble, styles.bubbleThem]}>
                <Text style={styles.bubbleText}>Thinking...</Text>
              </View>
            </View>
          ) : null
        }
      />

      {error && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={input}
          onChangeText={setInput}
          placeholder="Ask a question..."
          placeholderTextColor={colors.inkMuted}
          maxLength={2000}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!input.trim() || sending) && styles.sendBtnDisabled]}
          onPress={send}
          disabled={!input.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.background} />
          ) : (
            <Ionicons name="send" size={18} color={colors.background} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  list: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  emptyContent: { flexGrow: 1 },
  listContent: { padding: 16 },
  muted: { color: colors.inkMuted, fontSize: 13, textAlign: 'center', marginTop: 10 },
  notConfiguredTitle: { color: colors.ink, fontSize: 16, fontWeight: '700', marginTop: 12, marginBottom: 4 },
  errorText: { color: colors.wicket400, fontSize: 12, textAlign: 'center', paddingBottom: 6 },

  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '82%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleThem: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleMe: { backgroundColor: colors.pitch600, borderBottomRightRadius: 4 },
  bubbleText: { color: colors.ink, fontSize: 14, lineHeight: 20 },
  bubbleTextMe: { color: colors.ink },

  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 8, padding: 12,
    borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.surface,
  },
  input: {
    flex: 1, backgroundColor: colors.surfaceAlt, borderRadius: 18, borderWidth: 1, borderColor: colors.border,
    paddingHorizontal: 14, paddingVertical: 10, color: colors.ink, fontSize: 14, maxHeight: 100,
  },
  sendBtn: {
    width: 40, height: 40, borderRadius: 20, backgroundColor: colors.pitch500,
    alignItems: 'center', justifyContent: 'center',
  },
  sendBtnDisabled: { opacity: 0.5 },
});
