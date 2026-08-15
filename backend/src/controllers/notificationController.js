const Notification = require('../models/Notification');

// Bounded like every other list endpoint in this codebase (see the 57MB unbounded-matches-list
// bug fixed earlier this session) - a notification feed only ever needs to show recent activity,
// never the full lifetime history in one response.
const LIST_LIMIT = 50;

// @desc    The current user's notifications, newest first, capped at LIST_LIMIT.
// @route   GET /api/notifications
// @access  Private
exports.getMyNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.user.id })
      .sort({ createdAt: -1 })
      .limit(LIST_LIMIT);

    res.status(200).json({ success: true, count: notifications.length, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Unread notification count only - lets the bell icon badge itself cheaply without
//          fetching (or polling) the full list.
// @route   GET /api/notifications/unread-count
// @access  Private
exports.getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({ recipient: req.user.id, read: false });
    res.status(200).json({ success: true, count });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark a single notification read
// @route   PATCH /api/notifications/:id/read
// @access  Private (recipient only - never trust a client-supplied id for something that
//          changes data ownership, always compare against req.user.id server-side)
exports.markRead = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id);
    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    if (notification.recipient.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to update this notification' });
    }

    if (!notification.read) {
      notification.read = true;
      await notification.save();
    }

    res.status(200).json({ success: true, notification });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark all of the current user's unread notifications read (the "Mark all read" action)
// @route   PATCH /api/notifications/read-all
// @access  Private
exports.markAllRead = async (req, res) => {
  try {
    await Notification.updateMany({ recipient: req.user.id, read: false }, { read: true });
    res.status(200).json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
