const Notification = require('../models/Notification');
const Team = require('../models/Team');
const Player = require('../models/Player');
const User = require('../models/User');
const { sendPushNotifications } = require('./pushNotificationService');
const { sendNotificationEmail } = require('./emailNotificationService');

// Absolute origin used to build a clickable link inside emails - `Notification.link` is stored
// relative (see the model comment: web and mobile each resolve it against their own base), which
// is meaningless inside an email that isn't running inside either app. Falls back to the local
// web-app dev server since that's what's actually reachable during this session's live
// verification; a real deploy should set WEB_APP_URL to the real frontend origin.
const WEB_APP_URL = (process.env.WEB_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

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

// @desc    Best-effort push + email delivery for a batch of Notification docs that were JUST
//          insertMany'd (see insertAndDeliver below). This is the single place every notification
//          type's delivery goes through, so a new notification type only has to build recipient
//          docs and call insertAndDeliver - it gets push/email for free, no per-call-site wiring.
//          Never throws past this function; the in-app Notification write already succeeded by
//          the time this runs, so a delivery bug here must never undo it or bubble up to break
//          the real action (match update, announcement post, ...) that triggered it.
// @param   docs  the plain objects passed to insertMany - {recipient, type, title, message, link}
async function deliverNotifications(docs) {
  if (!docs || docs.length === 0) return;

  const recipientIds = [...new Set(docs.map((d) => d.recipient.toString()))];
  const users = await User.find({ _id: { $in: recipientIds } })
    .select('email pushToken notificationPreferences');
  const usersById = new Map(users.map((u) => [u._id.toString(), u]));

  const pushMessages = [];
  const emailSends = [];

  for (const doc of docs) {
    const user = usersById.get(doc.recipient.toString());
    if (!user) continue;

    // Legacy documents created before this pass may not have notificationPreferences persisted
    // (Mongoose applies the schema default on hydration, but only in memory until re-saved) -
    // treat a missing sub-object the same as the schema default of both channels enabled.
    const prefs = user.notificationPreferences || { push: true, email: true };

    if (prefs.push !== false && user.pushToken) {
      pushMessages.push({
        pushToken: user.pushToken,
        title: doc.title,
        body: doc.message,
        data: { link: doc.link || '', type: doc.type },
        userId: user._id.toString()
      });
    }

    if (prefs.email !== false && user.email) {
      emailSends.push(
        sendNotificationEmail({
          to: user.email,
          subject: doc.title,
          text: doc.link ? `${doc.message}\n\n${WEB_APP_URL}${doc.link}` : doc.message
        })
      );
    }
  }

  try {
    if (pushMessages.length > 0) await sendPushNotifications(pushMessages);
  } catch (error) {
    console.error('Push notification delivery failed:', error.message);
  }

  try {
    await Promise.all(emailSends);
  } catch (error) {
    console.error('Email notification delivery failed:', error.message);
  }
}

// @desc    Inserts the recipient Notification docs (unchanged behavior - the in-app feed both
//          frontends poll) and then fires best-effort push/email delivery for the same batch.
//          Delivery failures are caught here, same log-only discipline as every other post-save
//          side effect in this codebase (see matchController.updateMatch) - notification
//          *creation* succeeding is what matters; delivery is additive on top of it.
async function insertAndDeliver(docs) {
  await Notification.insertMany(docs);

  try {
    await deliverNotifications(docs);
  } catch (error) {
    console.error('Notification delivery (push/email) failed:', error.message);
  }
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

  await insertAndDeliver(docs);
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

  await insertAndDeliver(docs);
}

module.exports = { notifyMatchStatusChange, notifyTournamentAnnouncement };
