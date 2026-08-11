const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');
const Team = require('../models/Team');
const Player = require('../models/Player');

// group.members entries are sometimes a bare ObjectId (unpopulated) and sometimes a populated
// {_id, name} subdocument (e.g. getGroup populates for the response) - m.toString() on a
// populated document does NOT return its id, so this has to unwrap _id first when present.
function isMember(group, userId) {
  return group.members.some((m) => {
    const id = m && m._id ? m._id : m;
    return id.toString() === userId;
  });
}

// @desc    List groups the current user is a member of
// @route   GET /api/groups
// @access  Private
exports.getMyGroups = async (req, res) => {
  try {
    const groups = await Group.find({ members: req.user.id })
      .populate('team', 'name')
      .sort({ updatedAt: -1 });

    res.status(200).json({ success: true, groups });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a group - the creator is always a member and is the group's sole admin
//          (can rename, add/remove members, delete the group).
// @route   POST /api/groups
// @access  Private
exports.createGroup = async (req, res) => {
  try {
    const { name, teamId, memberIds } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Please provide a group name' });
    }

    let team = null;
    if (teamId) {
      team = await Team.findById(teamId);
      if (!team) {
        return res.status(404).json({ success: false, message: 'Team not found' });
      }
      // Tagging a group to a team only makes sense if you're actually on that team - checked via
      // the requester's own Player profile, same pattern messageController.js uses for team chat.
      const playerProfile = await Player.findOne({ user: req.user.id });
      const onTeam = playerProfile && (
        team.captain.toString() === playerProfile._id.toString() ||
        team.players.some((p) => p.toString() === playerProfile._id.toString())
      );
      if (!onTeam) {
        return res.status(403).json({ success: false, message: "You can only tag a group to a team you're on" });
      }
    }

    // Creator is always included, regardless of what memberIds contains.
    const members = new Set(Array.isArray(memberIds) ? memberIds : []);
    members.add(req.user.id);

    const group = await Group.create({
      name: name.trim(),
      team: team ? team._id : null,
      members: [...members],
      createdBy: req.user.id
    });

    await group.populate('team', 'name');

    res.status(201).json({ success: true, group });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a group's details (members list etc.) - members only
// @route   GET /api/groups/:id
// @access  Private
exports.getGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id)
      .populate('members', 'name')
      .populate('team', 'name')
      .populate('createdBy', 'name');

    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    if (!isMember(group, req.user.id)) {
      return res.status(403).json({ success: false, message: 'Only group members can view this group' });
    }

    res.status(200).json({ success: true, group });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Rename a group or add/remove members - creator (admin) only
// @route   PUT /api/groups/:id
// @access  Private (creator only)
exports.updateGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    if (group.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the group creator can manage this group' });
    }

    const { name, addMemberIds, removeMemberIds } = req.body;
    if (name && name.trim()) group.name = name.trim();

    if (Array.isArray(addMemberIds)) {
      const current = new Set(group.members.map((m) => m.toString()));
      addMemberIds.forEach((id) => current.add(id));
      group.members = [...current];
    }
    if (Array.isArray(removeMemberIds)) {
      // The creator can't remove themselves this way - they'd orphan the group's admin seat.
      // Use deleteGroup or a future "leave" flow for that instead.
      const toRemove = new Set(removeMemberIds.filter((id) => id !== group.createdBy.toString()));
      group.members = group.members.filter((m) => !toRemove.has(m.toString()));
    }

    await group.save();
    await group.populate('members', 'name');
    await group.populate('team', 'name');

    res.status(200).json({ success: true, group });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Leave a group (remove yourself). The creator can't leave - delete the group instead.
// @route   POST /api/groups/:id/leave
// @access  Private (members only)
exports.leaveGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    if (!isMember(group, req.user.id)) {
      return res.status(403).json({ success: false, message: 'You are not a member of this group' });
    }
    if (group.createdBy.toString() === req.user.id) {
      return res.status(400).json({ success: false, message: "The group creator can't leave - delete the group instead" });
    }

    group.members = group.members.filter((m) => m.toString() !== req.user.id);
    await group.save();

    res.status(200).json({ success: true, message: 'Left the group' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Delete a group and all its messages - creator only
// @route   DELETE /api/groups/:id
// @access  Private (creator only)
exports.deleteGroup = async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ success: false, message: 'Group not found' });
    }
    if (group.createdBy.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Only the group creator can delete this group' });
    }

    await GroupMessage.deleteMany({ group: group._id });
    await Group.findByIdAndDelete(group._id);

    res.status(200).json({ success: true, message: 'Group deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

module.exports.isMember = isMember;
