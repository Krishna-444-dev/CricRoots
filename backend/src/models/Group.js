const mongoose = require('mongoose');

// A WhatsApp-style group chat. `team` is an optional tag for "which team this group is
// associated with" (surfaced in the UI, e.g. "Groups" tab on a team page) - it does NOT drive
// access control. `members` is the actual, independently-managed access-control list: creating a
// group from a team roster starts as a copy of that roster, but members can be added/removed
// afterward without it staying in sync with the team - a group is its own persistent thing, the
// same way leaving a WhatsApp group doesn't remove you from the contact who added you.
const groupSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Please add a group name'],
      trim: true,
      maxlength: 100
    },
    team: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null
    },
    members: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
      }
    ],
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true
    }
  },
  {
    timestamps: true
  }
);

groupSchema.index({ members: 1 });
groupSchema.index({ team: 1 });

module.exports = mongoose.model('Group', groupSchema);
