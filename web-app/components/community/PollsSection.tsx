'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/AuthContext';
import { apiFetch } from '@/lib/apiFetch';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { inputClass, errorBoxClass } from '@/components/ui/formStyles';

interface PollOption {
  text: string;
  voteCount: number;
  percentage: number;
}

interface Poll {
  _id: string;
  question: string;
  options: PollOption[];
  totalVotes: number;
  myOptionIndex: number | null;
  isOpen: boolean;
  createdBy: string;
  createdAt: string;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

// Reusable community-feed polls list, scoped to exactly one team or tournament - shared by the
// Team detail page, the Tournament manager's Info tab, and the Community page's "my
// teams/tournaments" sections, so all three read and behave identically rather than each
// growing its own copy. `canManage` gates poll creation and early-close - the caller is
// responsible for computing it the same way every other admin/organizer check in this app does
// (team captain/vice-captain/coach, or tournament organizer), never trusting this component to
// re-derive it.
export default function PollsSection({
  scope,
  scopeId,
  canManage,
}: {
  scope: 'team' | 'tournament';
  scopeId: string;
  canManage: boolean;
}) {
  const { user } = useAuth();
  const [polls, setPolls] = useState<Poll[] | null>(null);
  const [error, setError] = useState('');
  const [votingId, setVotingId] = useState<string | null>(null);
  const [closingId, setClosingId] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const queryParam = scope === 'team' ? 'teamId' : 'tournamentId';

  const load = useCallback(async () => {
    try {
      const res = await apiFetch(`/api/polls?${queryParam}=${scopeId}`);
      const data = await res.json();
      if (data.success) setPolls(data.polls);
      else setError(data.message || 'Could not load polls');
    } catch {
      setError('Could not reach the CricRoots server');
    }
  }, [queryParam, scopeId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleVote = async (pollId: string, optionIndex: number) => {
    setVotingId(pollId);
    setError('');
    try {
      const res = await apiFetch(`/api/polls/${pollId}/vote`, {
        method: 'POST',
        body: JSON.stringify({ optionIndex }),
      });
      const data = await res.json();
      if (data.success) {
        setPolls((prev) => (prev ? prev.map((p) => (p._id === pollId ? data.poll : p)) : prev));
      } else {
        setError(data.message || 'Could not record your vote');
      }
    } catch {
      setError('Could not reach the CricRoots server');
    } finally {
      setVotingId(null);
    }
  };

  const handleClose = async (pollId: string) => {
    setClosingId(pollId);
    setError('');
    try {
      const res = await apiFetch(`/api/polls/${pollId}/close`, { method: 'PATCH' });
      const data = await res.json();
      if (data.success) {
        setPolls((prev) => (prev ? prev.map((p) => (p._id === pollId ? data.poll : p)) : prev));
      } else {
        setError(data.message || 'Could not close this poll');
      }
    } catch {
      setError('Could not reach the CricRoots server');
    } finally {
      setClosingId(null);
    }
  };

  const updateOption = (index: number, value: string) => {
    setOptions((prev) => prev.map((o, i) => (i === index ? value : o)));
  };
  const addOption = () => setOptions((prev) => (prev.length < MAX_OPTIONS ? [...prev, ''] : prev));
  const removeOption = (index: number) =>
    setOptions((prev) => (prev.length > MIN_OPTIONS ? prev.filter((_, i) => i !== index) : prev));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleanOptions.length < MIN_OPTIONS) return;
    setCreating(true);
    setCreateError('');
    try {
      const res = await apiFetch('/api/polls', {
        method: 'POST',
        body: JSON.stringify({
          question: question.trim(),
          options: cleanOptions,
          [queryParam]: scopeId,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setPolls((prev) => (prev ? [data.poll, ...prev] : [data.poll]));
        setQuestion('');
        setOptions(['', '']);
        setShowCreate(false);
      } else {
        setCreateError(data.message || 'Could not create poll');
      }
    } catch {
      setCreateError('Could not reach the CricRoots server');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-ink">Polls</h2>
        {canManage && !showCreate && (
          <Button type="button" size="sm" variant="secondary" onClick={() => setShowCreate(true)}>
            + New Poll
          </Button>
        )}
      </div>

      {error && <div className={`${errorBoxClass} mb-3`}>{error}</div>}

      {canManage && showCreate && (
        <Card className="mb-4" padding="sm">
          <form onSubmit={handleCreate} className="space-y-3">
            {createError && <div className={errorBoxClass}>{createError}</div>}
            <input
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Ask a question..."
              className={inputClass}
            />
            <div className="space-y-2">
              {options.map((opt, i) => (
                <div key={i} className="flex gap-2">
                  <input
                    value={opt}
                    onChange={(e) => updateOption(i, e.target.value)}
                    placeholder={`Option ${i + 1}`}
                    className={`flex-1 ${inputClass}`}
                  />
                  {options.length > MIN_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => removeOption(i)}
                      className="px-2 text-ink-muted hover:text-ink text-sm"
                      aria-label={`Remove option ${i + 1}`}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              {options.length < MAX_OPTIONS ? (
                <button type="button" onClick={addOption} className="text-sm text-pitch-400 hover:text-pitch-300 font-medium">
                  + Add option
                </button>
              ) : <span />}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => { setShowCreate(false); setCreateError(''); }}>
                  Cancel
                </Button>
                <Button type="submit" size="sm" disabled={creating || !question.trim() || options.filter((o) => o.trim()).length < MIN_OPTIONS}>
                  {creating ? 'Creating...' : 'Create Poll'}
                </Button>
              </div>
            </div>
          </form>
        </Card>
      )}

      {polls === null ? (
        <p className="text-sm text-ink-secondary">Loading polls...</p>
      ) : polls.length === 0 ? (
        <p className="text-sm text-ink-secondary">
          No polls yet.{canManage ? ' Create one to hear from the team.' : ''}
        </p>
      ) : (
        <div className="space-y-3">
          {polls.map((poll) => {
            const hasVoted = poll.myOptionIndex !== null;
            // Ownership display check - never a bare `===` between two possibly-null values
            // (see the createdBy/user?.id class of bug fixed elsewhere this session).
            const isPollCreator = Boolean(user?.id) && Boolean(poll.createdBy) && user!.id === poll.createdBy;
            return (
              <Card key={poll._id} padding="sm">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <p className="font-medium text-ink">{poll.question}</p>
                  {!poll.isOpen && <Badge variant="neutral">Closed</Badge>}
                </div>
                <div className="space-y-2">
                  {poll.options.map((opt, index) => {
                    const isMine = poll.myOptionIndex === index;
                    return (
                      <button
                        key={index}
                        type="button"
                        disabled={!poll.isOpen || !user || votingId === poll._id}
                        onClick={() => handleVote(poll._id, index)}
                        className={`w-full text-left rounded-lg border px-3 py-2 transition-colors ${
                          isMine ? 'border-pitch-500/60 bg-pitch-500/10' : 'border-border hover:border-border-strong'
                        } ${!poll.isOpen || !user ? 'cursor-default' : 'cursor-pointer'}`}
                      >
                        <div className="flex items-center justify-between text-sm mb-1">
                          <span className="text-ink flex items-center gap-1.5">
                            {opt.text}
                            {isMine && <span className="text-pitch-400 text-xs font-semibold">(your vote)</span>}
                          </span>
                          <span className="text-ink-secondary">{opt.percentage}% · {opt.voteCount}</span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-alt overflow-hidden">
                          <div
                            className={`h-full rounded-full ${isMine ? 'bg-pitch-400' : 'bg-border-strong'}`}
                            style={{ width: `${opt.percentage}%` }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-ink-muted">{poll.totalVotes} vote{poll.totalVotes === 1 ? '' : 's'}</p>
                  {poll.isOpen && (canManage || isPollCreator) && (
                    <button
                      type="button"
                      disabled={closingId === poll._id}
                      onClick={() => handleClose(poll._id)}
                      className="text-xs text-ink-muted hover:text-wicket-400 font-medium"
                    >
                      {closingId === poll._id ? 'Closing...' : 'Close poll'}
                    </button>
                  )}
                </div>
                {!user && poll.isOpen && (
                  <p className="text-xs text-ink-muted mt-2">Log in to vote.</p>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
