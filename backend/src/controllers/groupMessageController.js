const Group = require('../models/Group');
const GroupMessage = require('../models/GroupMessage');
const { isMember } = require('./groupController');
const { attachmentTypeFromMime } = require('../middleware/upload');
const fs = require('fs');

async function requireMembership(req, res) {
  const group = await Group.findById(req.params.id);
  if (!group) {
    res.status(404).json({ success: false, message: 'Group not found' });
    return null;
  }
  if (!isMember(group, req.user.id)) {
    res.status(403).json({ success: false, message: 'Only group members can do that' });
    return null;
  }
  return group;
}

// @desc    Get a group's message history (text, polls, and attachments interleaved,
//          chronological) - members only.
// @route   GET /api/groups/:id/messages
// @access  Private
exports.getGroupMessages = async (req, res) => {
  try {
    const group = await requireMembership(req, res);
    if (!group) return;

    const messages = await GroupMessage.find({ group: group._id })
      .populate('sender', 'name')
      .populate('poll.options.votes', 'name')
      .sort({ createdAt: 1 })
      .limit(300);

    res.status(200).json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Post a text message to a group
// @route   POST /api/groups/:id/messages
// @access  Private (members only)
exports.postGroupMessage = async (req, res) => {
  try {
    const group = await requireMembership(req, res);
    if (!group) return;

    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    let message = await GroupMessage.create({ group: group._id, sender: req.user.id, type: 'text', text: text.trim() });
    await message.populate('sender', 'name');

    req.socketManager.emitNewGroupMessage(group._id, message);
    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Create a poll in a group
// @route   POST /api/groups/:id/polls
// @access  Private (members only)
exports.createPoll = async (req, res) => {
  try {
    const group = await requireMembership(req, res);
    if (!group) return;

    const { question, options, allowMultiple } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ success: false, message: 'A poll question is required' });
    }
    const cleanOptions = Array.isArray(options) ? options.map((o) => String(o).trim()).filter(Boolean) : [];
    if (cleanOptions.length < 2) {
      return res.status(400).json({ success: false, message: 'A poll needs at least 2 options' });
    }
    if (cleanOptions.length > 10) {
      return res.status(400).json({ success: false, message: 'A poll can have at most 10 options' });
    }

    let message = await GroupMessage.create({
      group: group._id,
      sender: req.user.id,
      type: 'poll',
      poll: {
        question: question.trim(),
        allowMultiple: !!allowMultiple,
        options: cleanOptions.map((text) => ({ text, votes: [] }))
      }
    });
    await message.populate('sender', 'name');

    req.socketManager.emitNewGroupMessage(group._id, message);
    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Vote (or change your vote) on a poll. Toggles your vote on the given option; if the
//          poll doesn't allow multiple selections, voting for a new option clears any previous
//          vote you had on a different option in the same poll first.
// @route   POST /api/groups/:id/polls/:messageId/vote
// @access  Private (members only)
exports.voteOnPoll = async (req, res) => {
  try {
    const group = await requireMembership(req, res);
    if (!group) return;

    const { optionId } = req.body;
    if (!optionId) {
      return res.status(400).json({ success: false, message: 'optionId is required' });
    }

    const message = await GroupMessage.findOne({ _id: req.params.messageId, group: group._id, type: 'poll' });
    if (!message) {
      return res.status(404).json({ success: false, message: 'Poll not found' });
    }

    const option = message.poll.options.id(optionId);
    if (!option) {
      return res.status(404).json({ success: false, message: 'Poll option not found' });
    }

    const userId = req.user.id;
    const alreadyVotedThisOption = option.votes.some((v) => v.toString() === userId);

    if (!message.poll.allowMultiple && !alreadyVotedThisOption) {
      // Single-choice: clear any vote on other options before adding the new one.
      message.poll.options.forEach((o) => {
        if (o._id.toString() !== optionId) {
          o.votes = o.votes.filter((v) => v.toString() !== userId);
        }
      });
    }

    if (alreadyVotedThisOption) {
      option.votes = option.votes.filter((v) => v.toString() !== userId);
    } else {
      option.votes.push(userId);
    }

    await message.save();
    await message.populate('sender', 'name');
    await message.populate('poll.options.votes', 'name');

    req.socketManager.emitGroupPollUpdate(group._id, message);
    res.status(200).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Upload and send an image/video attachment to a group
// @route   POST /api/groups/:id/attachments
// @access  Private (members only)
exports.postGroupAttachment = async (req, res) => {
  try {
    const group = await requireMembership(req, res);
    if (!group) return;

    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file was uploaded' });
    }

    const type = attachmentTypeFromMime(req.file.mimetype);
    if (!type) {
      // fileFilter should already reject this, but double-check before it ever reaches a
      // message - a message with an unrecognized attachment type would break the frontend.
      fs.unlink(req.file.path, () => {});
      return res.status(400).json({ success: false, message: 'Unsupported file type' });
    }

    let message = await GroupMessage.create({
      group: group._id,
      sender: req.user.id,
      type,
      attachment: {
        url: `/uploads/group-attachments/${req.file.filename}`,
        mimeType: req.file.mimetype,
        fileName: req.file.originalname,
        sizeBytes: req.file.size
      }
    });
    await message.populate('sender', 'name');

    req.socketManager.emitNewGroupMessage(group._id, message);
    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
