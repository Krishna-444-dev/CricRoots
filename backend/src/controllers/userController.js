const User = require('../models/User');
const Follow = require('../models/Follow');

// @desc    Register (or replace) this device's Expo push token for the current user. Overwrites
//          any previously-stored token - see the User model comment: only the single most-recent
//          device is tracked, multi-device support is a known simplification left out of this pass.
// @route   PUT /api/users/push-token
// @access  Private
exports.updatePushToken = async (req, res) => {
  try {
    const { pushToken } = req.body;
    if (!pushToken || typeof pushToken !== 'string') {
      return res.status(400).json({ success: false, message: 'pushToken is required' });
    }

    req.user.pushToken = pushToken;
    await req.user.save();

    res.status(200).json({ success: true, pushToken: req.user.pushToken });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Partial update of the current user's push/email notification opt-in preferences -
//          either field may be omitted to leave it unchanged. See notificationService.js's
//          deliverNotifications, which reads these before firing push/email for any notification.
// @route   PUT /api/users/notification-preferences
// @access  Private
exports.updateNotificationPreferences = async (req, res) => {
  try {
    const { push, email } = req.body;
    if (typeof push !== 'boolean' && typeof email !== 'boolean') {
      return res.status(400).json({ success: false, message: 'Provide at least one of push/email as a boolean' });
    }

    // Defensive against a legacy document where the schema default hasn't been persisted yet
    // (see the model comment on notificationPreferences) - guarantees an object exists to assign into.
    if (!req.user.notificationPreferences) {
      req.user.notificationPreferences = { push: true, email: true };
    }
    if (typeof push === 'boolean') req.user.notificationPreferences.push = push;
    if (typeof email === 'boolean') req.user.notificationPreferences.email = email;
    await req.user.save();

    res.status(200).json({ success: true, notificationPreferences: req.user.notificationPreferences });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a public user profile
// @route   GET /api/users/:id
// @access  Public
exports.getUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('name role createdAt');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const [followerCount, followingCount] = await Promise.all([
      Follow.countDocuments({ following: user._id }),
      Follow.countDocuments({ follower: user._id })
    ]);

    res.status(200).json({ success: true, user, followerCount, followingCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Follow a user
// @route   POST /api/users/:id/follow
// @access  Private
exports.followUser = async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot follow yourself' });
    }

    const targetUser = await User.findById(req.params.id);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const existing = await Follow.findOne({ follower: req.user.id, following: req.params.id });
    if (existing) {
      return res.status(400).json({ success: false, message: 'Already following this user' });
    }

    await Follow.create({ follower: req.user.id, following: req.params.id });

    res.status(201).json({ success: true, message: 'Followed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Unfollow a user
// @route   DELETE /api/users/:id/follow
// @access  Private
exports.unfollowUser = async (req, res) => {
  try {
    const result = await Follow.findOneAndDelete({ follower: req.user.id, following: req.params.id });
    if (!result) {
      return res.status(400).json({ success: false, message: 'You are not following this user' });
    }

    res.status(200).json({ success: true, message: 'Unfollowed successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get a user's followers
// @route   GET /api/users/:id/followers
// @access  Public
exports.getFollowers = async (req, res) => {
  try {
    const follows = await Follow.find({ following: req.params.id }).populate('follower', 'name role');
    res.status(200).json({ success: true, count: follows.length, followers: follows.map(f => f.follower) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get who a user is following
// @route   GET /api/users/:id/following
// @access  Public
exports.getFollowing = async (req, res) => {
  try {
    const follows = await Follow.find({ follower: req.params.id }).populate('following', 'name role');
    res.status(200).json({ success: true, count: follows.length, following: follows.map(f => f.following) });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
