// Direct-message thread with one other player (backend/src/controllers/directMessageController.js).
// Fetching the thread (GET /messages/:userId) is also the mark-as-read mechanism server-side -
// there's no separate endpoint - so simply opening this screen clears that person's unread badge
// in the inbox and on the Profile tab on next focus/poll. No socket wiring for this v1 pass;
// sending refetches the thread so both sides of a just-sent message render immediately.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, ActivityIndicator,
  KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { api } from '../shared/api/apiClient';
import { useAuth } from '../hooks/useAuth';
import { DirectMessage } from '../shared/types';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? '' : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function MessageThreadScreen({ route, navigation }: any) {
  const otherUserId: string | undefined = route?.params?.userId;
  const otherUserName: string | undefined = route?.params?.name;
  const { user } = useAuth();

  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    navigation.setOptions({ title: otherUserName || 'Message' });
  }, [navigation, otherUserName]);

  const load = useCallback(() => {
    if (!otherUserId) {
      setError('No recipient specified.');
      setLoading(false);
      return;
    }
    setError(null);
    api.messages.getThread(otherUserId)
      .then(({ messages: fetched }) => setMessages(fetched))
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load messages'))
      .finally(() => setLoading(false));
  }, [otherUserId]);

  useEffect(() => { load(); }, [load]);

  const handleSend = async () => {
    const trimmed = text.trim();
    if (!trimmed || !otherUserId || sending) return;
    setSending(true);
    setText('');
    try {
      await api.messages.sendMessage(otherUserId, trimmed);
      const { messages: updated } = await api.messages.getThread(otherUserId);
      setMessages(updated);
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send message');
      setText(trimmed);
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={colors.pitch400} size="large" />
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
        keyExtractor={(item) => item._id}
        contentContainerStyle={messages.length === 0 ? styles.emptyContent : styles.listContent}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Ionicons name="chatbubble-ellipses-outline" size={28} color={colors.inkMuted} />
            <Text style={styles.muted}>{error || `Say hello to ${otherUserName || 'this player'}.`}</Text>
          </View>
        }
        renderItem={({ item }) => {
          const fromMe = !!user && item.sender._id === user.id;
          return (
            <View style={[styles.bubbleRow, fromMe ? styles.bubbleRowMe : styles.bubbleRowThem]}>
              <View style={[styles.bubble, fromMe ? styles.bubbleMe : styles.bubbleThem]}>
                <Text style={[styles.bubbleText, fromMe && styles.bubbleTextMe]}>{item.text}</Text>
                <Text style={[styles.bubbleTime, fromMe && styles.bubbleTimeMe]}>{formatTime(item.createdAt)}</Text>
              </View>
            </View>
          );
        }}
      />

      {error && messages.length > 0 && <Text style={styles.errorText}>{error}</Text>}

      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Type a message..."
          placeholderTextColor={colors.inkMuted}
          multiline
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!text.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!text.trim() || sending}
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
  errorText: { color: colors.wicket400, fontSize: 12, textAlign: 'center', paddingBottom: 6 },

  bubbleRow: { flexDirection: 'row', marginBottom: 10 },
  bubbleRowMe: { justifyContent: 'flex-end' },
  bubbleRowThem: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 8 },
  bubbleThem: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  bubbleMe: { backgroundColor: colors.pitch600, borderBottomRightRadius: 4 },
  bubbleText: { color: colors.ink, fontSize: 14 },
  bubbleTextMe: { color: colors.ink },
  bubbleTime: { color: colors.inkMuted, fontSize: 10, marginTop: 4, textAlign: 'right' },
  bubbleTimeMe: { color: 'rgba(241,245,249,0.7)' },

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
