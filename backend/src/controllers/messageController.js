const Message = require('../models/Message');
const Team = require('../models/Team');
const Player = require('../models/Player');
const Tournament = require('../models/Tournament');

async function isTeamMember(team, userId) {
  const playerProfile = await Player.findOne({ user: userId });
  if (!playerProfile) return false;
  if (team.captain.toString() === playerProfile._id.toString()) return true;
  return team.players.some(p => p.toString() === playerProfile._id.toString());
}

// @desc    Get team chat messages
// @route   GET /api/teams/:id/messages
// @access  Private (team members only)
exports.getTeamMessages = async (req, res) => {
  try {
    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    if (!(await isTeamMember(team, req.user.id))) {
      return res.status(403).json({ success: false, message: 'Only team members can view this chat' });
    }

    const messages = await Message.find({ team: team._id })
      .populate('sender', 'name')
      .sort({ createdAt: 1 })
      .limit(200);

    res.status(200).json({ success: true, count: messages.length, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Post a team chat message
// @route   POST /api/teams/:id/messages
// @access  Private (team members only)
exports.postTeamMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const team = await Team.findById(req.params.id);
    if (!team) {
      return res.status(404).json({ success: false, message: 'Team not found' });
    }

    if (!(await isTeamMember(team, req.user.id))) {
      return res.status(403).json({ success: false, message: 'Only team members can post in this chat' });
    }

    let message = await Message.create({ team: team._id, sender: req.user.id, text: text.trim() });
    await message.populate('sender', 'name');

    req.socketManager.emitNewMessage('team', team._id, message);

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get tournament announcements
// @route   GET /api/tournaments/:id/messages
// @access  Public
exports.getTournamentMessages = async (req, res) => {
  try {
    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    const messages = await Message.find({ tournament: tournament._id })
      .populate('sender', 'name')
      .sort({ createdAt: 1 })
      .limit(200);

    res.status(200).json({ success: true, count: messages.length, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Post a tournament announcement
// @route   POST /api/tournaments/:id/messages
// @access  Private (organizer only)
exports.postTournamentMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const tournament = await Tournament.findById(req.params.id);
    if (!tournament) {
      return res.status(404).json({ success: false, message: 'Tournament not found' });
    }

    if (tournament.organizer.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the tournament organizer can post announcements' });
    }

    let message = await Message.create({ tournament: tournament._id, sender: req.user.id, text: text.trim() });
    await message.populate('sender', 'name');

    req.socketManager.emitNewMessage('tournament', tournament._id, message);

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
