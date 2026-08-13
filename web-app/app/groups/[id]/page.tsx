'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import { useGroupSocket, GroupMessage } from '@/hooks/useGroupSocket';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { inputClass, errorBoxClass } from '@/components/ui/formStyles';
import { resolveRefId, resolveRefName } from '@/lib/resolveRef';

interface GroupMember {
  _id: string;
  name: string;
}

interface GroupDetail {
  _id: string;
  name: string;
  team: { _id: string; name: string } | null;
  members: GroupMember[];
  createdBy: GroupMember;
  createdAt: string;
  updatedAt: string;
}

interface PlayerDoc {
  _id: string;
  user: { _id: string; name: string } | string | null;
  specialization: string;
}

function playerUserId(p: PlayerDoc): string | null {
  return resolveRefId(p.user);
}

function playerDisplayName(p: PlayerDoc): string {
  return resolveRefName(p.user, p._id);
}

export default function GroupDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { user, token, isLoading } = useAuth();
  const [group, setGroup] = useState<GroupDetail | null>(null);
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [showMembers, setShowMembers] = useState(false);
  const [showPollForm, setShowPollForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Poll creation form state
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollSubmitting, setPollSubmitting] = useState(false);
  const [pollError, setPollError] = useState<string | null>(null);

  // Creator management state
  const [allPlayers, setAllPlayers] = useState<PlayerDoc[]>([]);
  const [renameValue, setRenameValue] = useState('');
  const [renaming, setRenaming] = useState(false);
  const [addMemberId, setAddMemberId] = useState('');
  const [managing, setManaging] = useState(false);
  const [manageError, setManageError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [groupRes, messagesRes] = await Promise.all([
      apiFetch(`/api/groups/${params.id}`).then((r) => r.json()),
      apiFetch(`/api/groups/${params.id}/messages`).then((r) => r.json()),
    ]);
    if (groupRes.success) {
      setGroup(groupRes.group);
      setRenameValue(groupRes.group.name);
    } else {
      setError(groupRes.message || 'Could not load group');
    }
    if (messagesRes.success) setMessages(messagesRes.messages);
    setLoading(false);
  }, [params.id]);

  useEffect(() => {
    if (!token) return;
    load();
    fetch('/api/players').then((r) => r.json()).then((data) => {
      if (data.success) setAllPlayers(data.players);
    });
  }, [token, load]);

  useGroupSocket({
    groupId: params.id,
    token,
    enabled: Boolean(token),
    onNewMessage: (message) => {
      setMessages((prev) => (prev.some((m) => m._id === message._id) ? prev : [...prev, message]));
    },
    onPollUpdate: (message) => {
      setMessages((prev) => prev.map((m) => (m._id === message._id ? message : m)));
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const isCreator = group && user ? group.createdBy._id === user.id : false;
  const memberIds = useMemo(() => new Set(group?.members.map((m) => m._id) ?? []), [group]);
  const addableCandidates = useMemo(
    () => allPlayers.filter((p) => {
      const uid = playerUserId(p);
      return uid !== null && !memberIds.has(uid); // null uid = orphaned player record, not addable
    }),
    [allPlayers, memberIds]
  );

  if (isLoading || loading) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)]"><p className="text-ink-secondary">Loading...</p></main>;
  }

  if (!user) {
    return (
      <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8 text-center">
        <div>
          <p className="text-ink-secondary mb-4">You need to be logged in to view this group.</p>
          <Link href="/login" className="text-pitch-400 hover:underline">Log in</Link>
        </div>
      </main>
    );
  }

  if (error || !group) {
    return <main className="flex items-center justify-center min-h-[calc(100vh-4rem)] p-8"><p className="text-ink-secondary">{error || 'Group not found.'}</p></main>;
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || sending) return;
    setSending(true);
    try {
      const res = await apiFetch(`/api/groups/${params.id}/messages`, {
        method: 'POST',
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      if (data.success) {
        setText('');
      } else {
        setError(data.message || 'Could not send message');
      }
    } catch {
      setError('Could not reach the CricRoots server');
    } finally {
      setSending(false);
    }
  };

  const handleVote = async (messageId: string, optionId: string) => {
    // The server broadcasts group-poll-update to everyone in the room (including us), which
    // patches this message's vote counts in place - no need to update state manually here.
    await apiFetch(`/api/groups/${params.id}/polls/${messageId}/vote`, {
      method: 'POST',
      body: JSON.stringify({ optionId }),
    });
  };

  const updatePollOption = (idx: number, value: string) => {
    setPollOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  };
  const addPollOption = () => setPollOptions((prev) => (prev.length < 10 ? [...prev, ''] : prev));
  const removePollOption = (idx: number) => setPollOptions((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev));

  const handleCreatePoll = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
    if (!pollQuestion.trim() || cleanOptions.length < 2) {
      setPollError('Add a question and at least 2 options');
      return;
    }
    setPollSubmitting(true);
    setPollError(null);
    try {
      const res = await apiFetch(`/api/groups/${params.id}/polls`, {
        method: 'POST',
        body: JSON.stringify({ question: pollQuestion, options: cleanOptions, allowMultiple: pollAllowMultiple }),
      });
      const data = await res.json();
      if (data.success) {
        setPollQuestion('');
        setPollOptions(['', '']);
        setPollAllowMultiple(false);
        setShowPollForm(false);
      } else {
        setPollError(data.message || 'Could not create poll');
      }
    } catch {
      setPollError('Could not reach the CricRoots server');
    } finally {
      setPollSubmitting(false);
    }
  };

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/groups/${params.id}/attachments`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        body: formData,
      });
      const data = await res.json();
      if (!data.success) {
        setUploadError(data.message || 'Upload failed');
      }
    } catch {
      setUploadError('Could not reach the CricRoots server');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameValue.trim() || renaming) return;
    setRenaming(true);
    setManageError(null);
    try {
      const res = await apiFetch(`/api/groups/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: renameValue }),
      });
      const data = await res.json();
      if (data.success) {
        setGroup(data.group);
      } else {
        setManageError(data.message || 'Could not rename group');
      }
    } finally {
      setRenaming(false);
    }
  };

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addMemberId || managing) return;
    setManaging(true);
    setManageError(null);
    try {
      const res = await apiFetch(`/api/groups/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify({ addMemberIds: [addMemberId] }),
      });
      const data = await res.json();
      if (data.success) {
        setGroup(data.group);
        setAddMemberId('');
      } else {
        setManageError(data.message || 'Could not add member');
      }
    } finally {
      setManaging(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (managing) return;
    setManaging(true);
    setManageError(null);
    try {
      const res = await apiFetch(`/api/groups/${params.id}`, {
        method: 'PUT',
        body: JSON.stringify({ removeMemberIds: [memberId] }),
      });
      const data = await res.json();
      if (data.success) {
        setGroup(data.group);
      } else {
        setManageError(data.message || 'Could not remove member');
      }
    } finally {
      setManaging(false);
    }
  };

  const handleDeleteGroup = async () => {
    if (!confirm('Delete this group and all its messages? This cannot be undone.')) return;
    const res = await apiFetch(`/api/groups/${params.id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      router.push('/groups');
    } else {
      setManageError(data.message || 'Could not delete group');
    }
  };

  const handleLeave = async () => {
    if (!confirm('Leave this group?')) return;
    const res = await apiFetch(`/api/groups/${params.id}/leave`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      router.push('/groups');
    } else {
      setManageError(data.message || 'Could not leave group');
    }
  };

  return (
    <main className="flex flex-col min-h-[calc(100vh-4rem)]">
      <div className="bg-surface border-b border-border p-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/groups" className="text-ink-secondary hover:text-ink transition-colors" aria-label="Back to groups">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m15 18-6-6 6-6"/></svg>
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold text-ink truncate">{group.name}</h1>
            {group.team && <p className="text-xs text-ink-muted">{group.team.name}</p>}
          </div>
          <button
            onClick={() => setShowMembers((v) => !v)}
            className="text-sm text-ink-secondary hover:text-ink transition-colors px-2 py-1 rounded-lg hover:bg-surface-hover whitespace-nowrap"
          >
            👥 {group.members.length}
          </button>
        </div>

        {showMembers && (
          <div className="max-w-2xl mx-auto mt-3 bg-surface-alt border border-border rounded-xl p-4 space-y-4">
            {manageError && <div className={errorBoxClass}>{manageError}</div>}

            <div>
              <p className="text-sm font-semibold text-ink mb-2">Members</p>
              <ul className="divide-y divide-border">
                {group.members.map((m) => (
                  <li key={m._id} className="py-2 flex items-center justify-between">
                    <span className="text-sm text-ink flex items-center gap-2">
                      {m.name}
                      {m._id === group.createdBy._id && <Badge variant="gold">Creator</Badge>}
                    </span>
                    {isCreator && m._id !== group.createdBy._id && (
                      <button onClick={() => handleRemoveMember(m._id)} disabled={managing} className="text-xs text-wicket-400 hover:text-wicket-500">
                        Remove
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            {isCreator ? (
              <>
                <form onSubmit={handleRename} className="flex gap-2">
                  <input value={renameValue} onChange={(e) => setRenameValue(e.target.value)} className={`flex-1 ${inputClass}`} />
                  <Button type="submit" size="sm" disabled={renaming || !renameValue.trim()}>Rename</Button>
                </form>

                {addableCandidates.length > 0 && (
                  <form onSubmit={handleAddMember} className="flex gap-2">
                    <select value={addMemberId} onChange={(e) => setAddMemberId(e.target.value)} className={`flex-1 ${inputClass}`}>
                      <option value="">Add a member...</option>
                      {addableCandidates.map((p) => (
                        // Non-null: addableCandidates is already filtered to exclude orphaned
                        // (null-uid) player records above.
                        <option key={p._id} value={playerUserId(p)!}>{playerDisplayName(p)}</option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="secondary" disabled={managing || !addMemberId}>Add</Button>
                  </form>
                )}

                <button onClick={handleDeleteGroup} className="text-sm text-wicket-400 hover:text-wicket-500">
                  Delete group
                </button>
              </>
            ) : (
              <button onClick={handleLeave} className="text-sm text-wicket-400 hover:text-wicket-500">
                Leave group
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 max-w-2xl mx-auto w-full scrollbar-thin">
        {messages.length === 0 ? (
          <p className="text-ink-muted text-center mt-8">No messages yet. Say hello to the group.</p>
        ) : (
          messages.map((m) => (
            <GroupMessageBubble key={m._id} message={m} isMe={m.sender._id === user.id} currentUserId={user.id} onVote={handleVote} />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {showPollForm && (
        <div className="bg-surface border-t border-border p-4 max-w-2xl mx-auto w-full">
          {pollError && <div className={`${errorBoxClass} mb-3`}>{pollError}</div>}
          <form onSubmit={handleCreatePoll} className="space-y-2">
            <input
              value={pollQuestion}
              onChange={(e) => setPollQuestion(e.target.value)}
              placeholder="Ask a question..."
              className={inputClass}
            />
            {pollOptions.map((opt, idx) => (
              <div key={idx} className="flex gap-2">
                <input
                  value={opt}
                  onChange={(e) => updatePollOption(idx, e.target.value)}
                  placeholder={`Option ${idx + 1}`}
                  className={`flex-1 ${inputClass}`}
                />
                {pollOptions.length > 2 && (
                  <button type="button" onClick={() => removePollOption(idx)} className="text-ink-muted hover:text-wicket-400 px-2">✕</button>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {pollOptions.length < 10 && (
                  <button type="button" onClick={addPollOption} className="text-sm text-pitch-400 hover:underline">+ Add option</button>
                )}
                <label className="flex items-center gap-1.5 text-sm text-ink-secondary">
                  <input type="checkbox" checked={pollAllowMultiple} onChange={(e) => setPollAllowMultiple(e.target.checked)} className="accent-pitch-500" />
                  Allow multiple choices
                </label>
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => setShowPollForm(false)}>Cancel</Button>
                <Button type="submit" size="sm" disabled={pollSubmitting}>{pollSubmitting ? 'Posting...' : 'Post Poll'}</Button>
              </div>
            </div>
          </form>
        </div>
      )}

      <form onSubmit={handleSend} className="bg-surface border-t border-border p-4 flex gap-2 max-w-2xl mx-auto w-full items-center">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp,video/mp4,video/quicktime,video/webm"
          className="hidden"
          onChange={handleFileSelected}
        />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="p-2 rounded-lg text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors disabled:opacity-50"
          aria-label="Attach image or video"
          title="Attach image or video"
        >
          {uploading ? '⏳' : '📎'}
        </button>
        <button
          type="button"
          onClick={() => setShowPollForm((v) => !v)}
          className="p-2 rounded-lg text-ink-secondary hover:text-ink hover:bg-surface-hover transition-colors"
          aria-label="Create poll"
          title="Create poll"
        >
          📊
        </button>
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Message the group..."
          className="flex-1 min-w-0 px-3 py-2 bg-surface-alt border border-border-strong rounded-lg text-ink placeholder:text-ink-muted focus:outline-none focus:ring-2 focus:ring-pitch-500/50 focus:border-pitch-500"
        />
        <Button type="submit" disabled={sending || !text.trim()}>Send</Button>
      </form>
      {uploadError && <p className="max-w-2xl mx-auto w-full px-4 pb-3 text-sm text-wicket-400">{uploadError}</p>}
    </main>
  );
}

function GroupMessageBubble({
  message,
  isMe,
  currentUserId,
  onVote,
}: {
  message: GroupMessage;
  isMe: boolean;
  currentUserId: string;
  onVote: (messageId: string, optionId: string) => void;
}) {
  const time = new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (message.type === 'poll' && message.poll) {
    const totalVotes = message.poll.options.reduce((sum, o) => sum + o.votes.length, 0);
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-sm w-full rounded-xl px-3 py-3 bg-surface border border-border text-ink">
          {!isMe && <p className="text-xs font-semibold text-ink-secondary mb-1">{message.sender.name}</p>}
          <p className="text-sm font-semibold mb-2">📊 {message.poll.question}</p>
          <div className="space-y-1.5">
            {message.poll.options.map((opt) => {
              const votedByMe = opt.votes.some((v) => v._id === currentUserId);
              const pct = totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 100) : 0;
              return (
                <button
                  key={opt._id}
                  onClick={() => onVote(message._id, opt._id)}
                  className={`w-full text-left rounded-lg border px-2.5 py-1.5 relative overflow-hidden transition-colors ${
                    votedByMe ? 'border-pitch-500 bg-pitch-500/10' : 'border-border-strong hover:bg-surface-hover'
                  }`}
                >
                  <div className="flex justify-between items-center text-sm relative z-10">
                    <span className={votedByMe ? 'text-pitch-400 font-medium' : 'text-ink'}>{opt.text}</span>
                    <span className="text-ink-muted text-xs">{opt.votes.length} · {pct}%</span>
                  </div>
                  {opt.votes.length > 0 && (
                    <p className="text-[10px] text-ink-muted mt-0.5 truncate relative z-10">
                      {opt.votes.map((v) => v.name).join(', ')}
                    </p>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[10px] text-ink-muted mt-2">{message.poll.allowMultiple ? 'Multiple choice' : 'Single choice'} · {time}</p>
        </div>
      </div>
    );
  }

  if (message.type === 'image' && message.attachment) {
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-xs rounded-xl overflow-hidden bg-surface border border-border">
          {!isMe && <p className="text-xs font-semibold text-ink-secondary px-3 pt-2">{message.sender.name}</p>}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={message.attachment.url} alt={message.attachment.fileName} className="max-w-full max-h-80 object-contain" />
          <p className="text-[10px] text-ink-muted px-3 py-1.5">{time}</p>
        </div>
      </div>
    );
  }

  if (message.type === 'video' && message.attachment) {
    return (
      <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-xs rounded-xl overflow-hidden bg-surface border border-border">
          {!isMe && <p className="text-xs font-semibold text-ink-secondary px-3 pt-2">{message.sender.name}</p>}
          <video controls src={message.attachment.url} className="max-w-full max-h-80" />
          <p className="text-[10px] text-ink-muted px-3 py-1.5">{time}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
      <div className={`max-w-xs rounded-xl px-3 py-2 ${isMe ? 'bg-pitch-500 text-[#06170D]' : 'bg-surface border border-border text-ink'}`}>
        {!isMe && <p className="text-xs font-semibold text-ink-secondary mb-0.5">{message.sender.name}</p>}
        <p className="text-sm">{message.text}</p>
        <p className={`text-[10px] mt-1 ${isMe ? 'text-[#06170D]/60' : 'text-ink-muted'}`}>{time}</p>
      </div>
    </div>
  );
}
