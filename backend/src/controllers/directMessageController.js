const mongoose = require('mongoose');
const DirectMessage = require('../models/DirectMessage');
const User = require('../models/User');

function oid(id) {
  return new mongoose.Types.ObjectId(id);
}

// @desc    List conversations (inbox) - one row per person you've exchanged messages with,
//          most recently active first, with an unread count per conversation.
// @route   GET /api/messages/conversations
// @access  Private
exports.getConversations = async (req, res) => {
  try {
    const userId = oid(req.user.id);

    const rows = await DirectMessage.aggregate([
      { $match: { $or: [{ sender: userId }, { recipient: userId }] } },
      { $sort: { createdAt: -1 } },
      {
        $group: {
          _id: { $cond: [{ $eq: ['$sender', userId] }, '$recipient', '$sender'] },
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [{ $and: [{ $eq: ['$recipient', userId] }, { $eq: ['$read', false] }] }, 1, 0]
            }
          }
        }
      },
      { $sort: { 'lastMessage.createdAt': -1 } }
    ]);

    const users = await User.find({ _id: { $in: rows.map((r) => r._id) } }).select('name');
    const userById = new Map(users.map((u) => [u._id.toString(), u]));

    const conversations = rows.map((r) => ({
      user: userById.get(r._id.toString()) ? { _id: r._id, name: userById.get(r._id.toString()).name } : null,
      lastMessage: {
        text: r.lastMessage.text,
        createdAt: r.lastMessage.createdAt,
        fromMe: r.lastMessage.sender.toString() === req.user.id
      },
      unreadCount: r.unreadCount
    })).filter((c) => c.user !== null);

    res.status(200).json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Total unread DM count across all conversations, for a badge indicator
// @route   GET /api/messages/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await DirectMessage.countDocuments({ recipient: req.user.id, read: false });
    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get the full message thread with a specific user, and mark their messages to you
//          as read in the same request.
// @route   GET /api/messages/:userId
// @access  Private
exports.getThread = async (req, res) => {
  try {
    const otherUserId = req.params.userId;

    const messages = await DirectMessage.find({
      $or: [
        { sender: req.user.id, recipient: otherUserId },
        { sender: otherUserId, recipient: req.user.id }
      ]
    })
      .sort({ createdAt: 1 })
      .limit(200)
      .populate('sender', 'name')
      .populate('recipient', 'name');

    await DirectMessage.updateMany(
      { sender: otherUserId, recipient: req.user.id, read: false },
      { $set: { read: true } }
    );

    res.status(200).json({ success: true, messages });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Send a direct message to a specific user
// @route   POST /api/messages/:userId
// @access  Private
exports.sendMessage = async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) {
      return res.status(400).json({ success: false, message: 'Message text is required' });
    }

    const recipientId = req.params.userId;
    if (recipientId === req.user.id) {
      return res.status(400).json({ success: false, message: "You can't message yourself" });
    }

    const recipient = await User.findById(recipientId);
    if (!recipient) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    let message = await DirectMessage.create({ sender: req.user.id, recipient: recipientId, text: text.trim() });
    await message.populate('sender', 'name');
    await message.populate('recipient', 'name');

    req.socketManager.emitDirectMessage(recipientId, message);

    res.status(201).json({ success: true, message });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
