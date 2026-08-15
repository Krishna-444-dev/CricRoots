const Poll = require('../models/Poll');
const Team = require('../models/Team');
const Tournament = require('../models/Tournament');
const Player = require('../models/Player');

// Bounded like every other list endpoint in this codebase (see the 57MB unbounded-matches-list
// bug fixed earlier this session) - a club/tournament poll feed never realistically needs more
// than this in one response.
const LIST_LIMIT = 100;

// team.captain/viceCaptain/coaches are unpopulated ObjectIds at the point these checks run
// (Team.findById with no .populate()) - same defensive unwrap as teamController.js's
// refMatches, in case a populated subdocument ever reaches this.
function refMatches(ref, playerId) {
  if (!ref) return false;
  const id = ref._id ? ref._id : ref;
  return id.toString() === playerId;
}

// Day-to-day team management: captain, vice-captain, or any coach - exact precedent as
// teamController.js's isTeamAdmin (a poll's "team captain/coach" creator role maps onto the
// same admin tier that can already update the team/add players).
function isTeamAdmin(team, playerId) {
  if (refMatches(team.captain, playerId)) return true;
  if (refMatches(team.viceCaptain, playerId)) return true;
  return (team.coaches || []).some((c) => refMatches(c, playerId));
}

// Rostered on the team at all (captain/vice-captain/coach are always also in `players`, by
// construction - see teamController.js's createTeam/addPlayerToTeam) - the "any member" voting
// bar, same join messageController.js's isTeamMember uses for team-chat access.
function isTeamRoster(team, playerId) {
  return (team.players || []).some((p) => refMatches(p, playerId));
}

// Rostered on ANY team registered in the tournament - the same Team -> Player join
// leagueController.js's getMyLeagues and notificationService.js's userIdsForTeams both
// established this session for "who belongs to this tournament", just checked in the
// direction of a single candidate player rather than fanned out to every player.
async function isRosteredInTournament(tournament, playerId) {
  const count = await Team.countDocuments({ _id: { $in: tournament.teams || [] }, players: playerId });
  return count > 0;
}

async function getPlayerProfile(userId) {
  return Player.findOne({ user: userId }).select('_id');
}

// Who may create/manage a poll for a given scope: team captain/coach (isTeamAdmin) for a
// team-scoped poll, or the tournament organizer (exact precedent as every organizer-only
// action in tournamentController.js: `tournament.organizer.toString() === req.user.id`) for a
// tournament-scoped poll. Never trusts a client-supplied id - always resolved from req.user.id
// server-side.
async function canManagePollScope({ team, tournament }, userId) {
  if (team) {
    const playerProfile = await getPlayerProfile(userId);
    if (!playerProfile) return false;
    return isTeamAdmin(team, playerProfile._id.toString());
  }
  if (tournament) {
    return Boolean(tournament.organizer) && tournament.organizer.toString() === userId;
  }
  return false;
}

// Who may vote on a poll: any rostered player on the team, or any rostered player on any team
// registered in the tournament - see isTeamRoster/isRosteredInTournament above.
async function canVoteOnPoll(poll, userId) {
  const playerProfile = await getPlayerProfile(userId);
  if (!playerProfile) return false;
  const playerId = playerProfile._id.toString();

  if (poll.team) {
    const team = await Team.findById(poll.team).select('players');
    if (!team) return false;
    return isTeamRoster(team, playerId);
  }
  if (poll.tournament) {
    const tournament = await Tournament.findById(poll.tournament).select('teams');
    if (!tournament) return false;
    return isRosteredInTournament(tournament, playerId);
  }
  return false;
}

// Shapes a Poll document for API responses: computed vote counts/percentages per option
// (never the raw voter-id arrays - those are only ever read internally to compute this and to
// check "have I voted"), plus this viewer's own choice if they've voted and are known
// (`userId` is undefined for an unauthenticated request, in which case `myOptionIndex` is
// always null).
function serializePoll(poll, userId) {
  const totalVotes = poll.options.reduce((sum, opt) => sum + opt.votes.length, 0);
  let myOptionIndex = null;

  const options = poll.options.map((opt, index) => {
    if (userId && opt.votes.some((v) => v.toString() === userId)) {
      myOptionIndex = index;
    }
    return {
      text: opt.text,
      voteCount: opt.votes.length,
      percentage: totalVotes > 0 ? Math.round((opt.votes.length / totalVotes) * 1000) / 10 : 0
    };
  });

  return {
    _id: poll._id,
    question: poll.question,
    options,
    totalVotes,
    myOptionIndex,
    team: poll.team,
    tournament: poll.tournament,
    createdBy: poll.createdBy,
    isOpen: poll.isOpen,
    createdAt: poll.createdAt
  };
}

// @desc    Create a poll scoped to exactly one team or tournament - team captain/coach or
//          tournament organizer only (see canManagePollScope).
// @route   POST /api/polls
// @access  Private
exports.createPoll = async (req, res) => {
  try {
    const { question, options, teamId, tournamentId } = req.body;

    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a poll question' });
    }
    const cleanOptions = Array.isArray(options) ? options.map((o) => String(o).trim()).filter(Boolean) : [];
    if (cleanOptions.length < 2 || cleanOptions.length > 6) {
      return res.status(400).json({ success: false, message: 'A poll needs between 2 and 6 options' });
    }
    if (Boolean(teamId) === Boolean(tournamentId)) {
      return res.status(400).json({ success: false, message: 'Provide exactly one of teamId or tournamentId' });
    }

    let team = null;
    let tournament = null;
    if (teamId) {
      team = await Team.findById(teamId);
      if (!team) return res.status(404).json({ success: false, message: 'Team not found' });
    } else {
      tournament = await Tournament.findById(tournamentId);
      if (!tournament) return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    if (!(await canManagePollScope({ team, tournament }, req.user.id))) {
      return res.status(403).json({
        success: false,
        message: team
          ? 'Only the team captain, vice-captain, or a coach can create a poll for this team'
          : 'Only the tournament organizer can create a poll for this tournament'
      });
    }

    const poll = await Poll.create({
      question: question.trim(),
      options: cleanOptions.map((text) => ({ text, votes: [] })),
      team: team ? team._id : null,
      tournament: tournament ? tournament._id : null,
      createdBy: req.user.id
    });

    res.status(201).json({ success: true, poll: serializePoll(poll, req.user.id) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    List polls for a team or tournament, newest first, bounded at LIST_LIMIT. Public
//          read (same as tournament announcements) - `myOptionIndex` is only populated when
//          the request is authenticated (optionalAuth).
// @route   GET /api/polls?teamId=<id> | ?tournamentId=<id>
// @access  Public
exports.getPolls = async (req, res) => {
  try {
    const { teamId, tournamentId } = req.query;
    if (Boolean(teamId) === Boolean(tournamentId)) {
      return res.status(400).json({ success: false, message: 'Provide exactly one of teamId or tournamentId' });
    }

    const query = teamId ? { team: teamId } : { tournament: tournamentId };
    const polls = await Poll.find(query).sort({ createdAt: -1 }).limit(LIST_LIMIT);

    const userId = req.user ? req.user.id : undefined;
    res.status(200).json({
      success: true,
      count: polls.length,
      polls: polls.map((p) => serializePoll(p, userId))
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Vote (or change a prior vote) on a poll. One vote per user, enforced by removing any
//          existing vote across all options before adding the new one - re-voting changes your
//          pick rather than adding a second ballot.
// @route   POST /api/polls/:id/vote
// @access  Private (membership-checked - see canVoteOnPoll)
exports.votePoll = async (req, res) => {
  try {
    const { optionIndex } = req.body;
    const poll = await Poll.findById(req.params.id);
    if (!poll) {
      return res.status(404).json({ success: false, message: 'Poll not found' });
    }
    if (!poll.isOpen) {
      return res.status(400).json({ success: false, message: 'This poll is closed' });
    }
    if (!Number.isInteger(optionIndex) || optionIndex < 0 || optionIndex >= poll.options.length) {
      return res.status(400).json({ success: false, message: 'Invalid optionIndex' });
    }

    if (!(await canVoteOnPoll(poll, req.user.id))) {
      return res.status(403).json({
        success: false,
        message: poll.team
          ? 'Only players rostered on this team can vote'
          : 'Only players rostered on a team in this tournament can vote'
      });
    }

    // Strip any prior vote by this user from every option first, then add the new one - this
    // is what makes re-voting a change rather than a duplicate ballot.
    poll.options.forEach((opt) => {
      opt.votes = opt.votes.filter((v) => v.toString() !== req.user.id);
    });
    poll.options[optionIndex].votes.push(req.user.id);

    await poll.save();

    res.status(200).json({ success: true, poll: serializePoll(poll, req.user.id) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Close a poll early - the poll's creator, or anyone who currently holds the
//          manager/organizer role for its scope (team captain/vice-captain/coach, or
//          tournament organizer), same "creator or manager" precedent as canManageMatch
//          (match creator OR an appointed umpire OR a rostered player all qualify there).
// @route   PATCH /api/polls/:id/close
// @access  Private (creator/manager only)
exports.closePoll = async (req, res) => {
  try {
    const poll = await Poll.findById(req.params.id);
    if (!poll) {
      return res.status(404).json({ success: false, message: 'Poll not found' });
    }

    // Never trust a bare `===` between two possibly-null values for an ownership check -
    // `poll.createdBy` is always set at creation time, but guard explicitly anyway.
    const isCreator = Boolean(poll.createdBy) && poll.createdBy.toString() === req.user.id;

    let isManager = false;
    if (!isCreator) {
      const team = poll.team ? await Team.findById(poll.team) : null;
      const tournament = poll.tournament ? await Tournament.findById(poll.tournament) : null;
      isManager = await canManagePollScope({ team, tournament }, req.user.id);
    }

    if (!isCreator && !isManager) {
      return res.status(403).json({ success: false, message: 'Only the poll creator or a manager for this team/tournament can close this poll' });
    }

    poll.isOpen = false;
    await poll.save();

    res.status(200).json({ success: true, poll: serializePoll(poll, req.user.id) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
