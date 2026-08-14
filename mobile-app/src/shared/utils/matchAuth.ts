// Who's allowed to score/manage a match on mobile - mirrors canManageMatch() on the backend
// (backend/src/controllers/matchController.js, the real enforcement) and web-app's equivalent:
// the match creator, any appointed umpire, or anyone actually rostered on either playing team -
// not just the creator. Centralized here after LiveScoringScreen.tsx and MatchDetailScreen.tsx
// each had their own independent, and independently stale, copy of this check -
// MatchDetailScreen's never got updated when scoring access was broadened past creator-only,
// so its "Score this match" button stayed invisible to everyone else even though
// LiveScoringScreen itself would have let them in.
import type { Match, Player } from '../types';

export function resolveUserId(u: Match['createdBy'] | undefined | null): string | null {
  if (!u) return null;
  if (typeof u === 'string') return u;
  const any = u as any;
  return any._id ?? any.id ?? null;
}

export function rosterIds(team: Match['team1'] | undefined): string[] {
  if (!team || typeof team === 'string') return [];
  return (team.players || []).map((p) => (typeof p === 'string' ? p : p._id));
}

export function computeCanScore(
  match: Match | null | undefined,
  userId: string | null | undefined,
  players: Player[]
): { isOwner: boolean; canScore: boolean } {
  if (!match || !userId) return { isOwner: false, canScore: false };
  const ownerId = resolveUserId(match.createdBy);
  const isOwner = !!ownerId && ownerId === userId;
  const isUmpire = (match.umpires || []).some((u) => resolveUserId(u) === userId);
  const myPlayer = players.find((p) => resolveUserId(p.user) === userId);
  const isRostered =
    !!myPlayer && (rosterIds(match.team1).includes(myPlayer._id) || rosterIds(match.team2).includes(myPlayer._id));
  return { isOwner, canScore: isOwner || isUmpire || isRostered };
}
