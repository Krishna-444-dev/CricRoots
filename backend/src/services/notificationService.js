const Notification = require('../models/Notification');
const Team = require('../models/Team');
const Player = require('../models/Player');

// Same Team -> Player -> User join pattern leagueController.js's getMyLeagues uses (a team's
// `players` array holds Player ids, and a Player's `user` field is the actual account) - just
// run in the forward direction (teams -> their rostered users) instead of backward (a user's
// own teams). Dedupes at both hops so a player who somehow appears twice (or a user with two
// Player profiles, though nothing in this codebase creates that) is only notified once.
async function userIdsForTeams(teamIds) {
  const ids = [...new Set(teamIds.filter(Boolean).map((t) => (t._id ? t._id : t).toString()))];
  if (ids.length === 0) return [];

  const teams = await Team.find({ _id: { $in: ids } }).select('players');
  const playerIds = [...new Set(teams.flatMap((t) => (t.players || []).map((p) => p.toString())))];
  if (playerIds.length === 0) return [];

  const players = await Player.find({ _id: { $in: playerIds } }).select('user');
  return [...new Set(players.map((p) => p.user.toString()))];
}

// @desc    Notify every rostered player on either playing team that a match has just gone Live
//          or just finished. Called from matchController.updateMatch only on an actual
//          transition into that status (not a no-op re-save of an already-Live/Completed
//          match) - see the guarded call site there.
// @param   match  a Match document with team1/team2 populated (needed for the team names in
//                  the notification title/message; falls back gracefully if not populated)
// @param   type   'match_live' | 'match_completed'
async function notifyMatchStatusChange(match, type) {
  const recipientIds = await userIdsForTeams([match.team1, match.team2]);
  if (recipientIds.length === 0) return;

  const team1Name = (match.team1 && match.team1.name) || 'Team 1';
  const team2Name = (match.team2 && match.team2.name) || 'Team 2';
  const title = type === 'match_live'
    ? `${team1Name} vs ${team2Name} is live`
    : `${team1Name} vs ${team2Name} has ended`;
  const message = type === 'match_live'
    ? `The match at ${match.venue} has just gone live.`
    : `The match at ${match.venue} has finished. Check out the scorecard.`;

  const docs = recipientIds.map((userId) => ({
    recipient: userId,
    type,
    title,
    message,
    link: `/match/${match._id}`,
    relatedMatch: match._id
  }));

  await Notification.insertMany(docs);
}

// @desc    Notify every rostered player on any team registered in a tournament that its
//          organizer just posted an announcement. Called from
//          messageController.postTournamentMessage. `tournament.teams` already holds every
//          registered team regardless of whether the tournament has been split into divisions
//          (assignDivisions partitions this same array into `divisions[].teams`, it doesn't
//          replace it - see tournamentController.js), so no separate division-aware branch is
//          needed here.
async function notifyTournamentAnnouncement(tournament, announcementText) {
  const recipientIds = await userIdsForTeams(tournament.teams || []);
  if (recipientIds.length === 0) return;

  const preview = announcementText.length > 200 ? `${announcementText.slice(0, 197)}...` : announcementText;

  const docs = recipientIds.map((userId) => ({
    recipient: userId,
    type: 'tournament_announcement',
    title: `New announcement: ${tournament.name}`,
    message: preview,
    link: `/tournaments?tournamentId=${tournament._id}`,
    relatedTournament: tournament._id
  }));

  await Notification.insertMany(docs);
}

module.exports = { notifyMatchStatusChange, notifyTournamentAnnouncement };
