const mongoose = require('mongoose');

// A single cricket-knowledge trivia item - the "trivia of the day" community-feed card
// (CricHeroes-style). Not scoped to a team/tournament, global/app-wide by design. Users answer
// once; `answeredBy` doubles as both the answer log and the "have I already answered this"
// check, same reasoning Poll.js's per-option `votes` array uses.
const triviaSchema = new mongoose.Schema(
  {
    question: {
      type: String,
      required: true,
      trim: true,
      maxlength: 300
    },
    options: {
      type: [String],
      validate: {
        validator: (opts) => Array.isArray(opts) && opts.length === 4,
        message: 'Trivia needs exactly 4 options'
      }
    },
    correctIndex: {
      type: Number,
      required: true,
      min: 0,
      max: 3
    },
    explanation: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1000
    },
    answeredBy: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
          required: true
        },
        optionIndex: {
          type: Number,
          required: true
        },
        answeredAt: {
          type: Date,
          default: Date.now
        }
      }
    ],
    isActive: {
      type: Boolean,
      default: true
    }
  },
  { timestamps: true }
);

// Powers "the most recent active trivia item" (GET /api/trivia/current) without a collection
// scan, same reasoning as every other compound index in this codebase.
triviaSchema.index({ isActive: 1, createdAt: -1 });

module.exports = mongoose.model('Trivia', triviaSchema);
