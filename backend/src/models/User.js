const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please add a name']
  },
  email: {
    type: String,
    required: [true, 'Please add an email'],
    unique: true,
    // Deliberately simple and linear-time: no nested/overlapping quantifiers. The previous
    // pattern (\w+([\.-]?\w+)*@...) was a textbook catastrophic-backtracking ReDoS - a ~40
    // character crafted local-part (found via real testing during this session, e.g. any
    // run of 30+ word characters with no valid match) pegs the single-threaded Node event
    // loop for the entire process, hanging the whole backend for every user, not just the
    // request that sent it. Confirmed by direct measurement: 20 chars ~29ms, 25 ~72ms,
    // 30 ~2.3s, 35+ still running after 8s+ (exponential, not linear). This pattern can't
    // exhibit that class of blowup - every `+` operates on a simple negated character class
    // with no ambiguous partitioning for the regex engine to backtrack through.
    match: [
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
      'Please add a valid email'
    ]
  },
  password: {
    type: String,
    required: [true, 'Please add a password'],
    minlength: 6,
    select: false
  },
  role: {
    type: String,
    enum: ['player', 'captain', 'organizer', 'admin', 'sponsor', 'collaborator'],
    default: 'player'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Encrypt password using bcrypt
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
