// URGENT recovery: restores the real "Test Krishna" User + Player documents, accidentally
// deleted by cleanupSyntheticData.js on 2026-08-14 (that script's player/user deletion set
// wasn't filtered to exclude him, unlike the very first manual cleanup attempt earlier the
// same session). Recreated under the EXACT SAME _ids as the originals so every existing
// reference throughout the app (matches, teams, JWT-authenticated sessions whose token
// encodes this user id) resolves correctly again without needing to touch anything else.
// The original bcrypt password hash cannot be recovered (one-way hash, never read/stored by
// this script) - sets a known temporary password the user must change/reset.

const mongoose = require('mongoose');
const { connectDB, User, Player } = require('./simulateTournament');

const USER_ID = '6a7b86618dc0c108af5a4eda';
const PLAYER_ID = '6a7e082a6d57aed3f8fa1e5b';
const EMAIL = 'kreddy285@gmail.com';
const TEMP_PASSWORD = 'RestoreKrishna2026!';

async function main() {
  await connectDB();

  const existingUser = await User.findById(USER_ID);
  if (existingUser) {
    console.log('User already exists - no action needed.');
  } else {
    await User.create({
      _id: new mongoose.Types.ObjectId(USER_ID),
      name: 'Test Krishna',
      email: EMAIL,
      password: TEMP_PASSWORD, // hashed by the User pre-save hook
      role: 'player'
    });
    console.log('Restored User', USER_ID, EMAIL);
  }

  const existingPlayer = await Player.findById(PLAYER_ID);
  if (existingPlayer) {
    console.log('Player already exists - no action needed.');
  } else {
    await Player.create({
      _id: new mongoose.Types.ObjectId(PLAYER_ID),
      user: new mongoose.Types.ObjectId(USER_ID),
      specialization: 'All-rounder',
      battingStyle: 'Right-hand',
      bowlingStyle: 'Right-arm Fast'
    });
    console.log('Restored Player', PLAYER_ID);
  }

  console.log('\nIMPORTANT: temporary password set to', TEMP_PASSWORD, '- change it via the app.');
  process.exit(0);
}

main().catch((e) => {
  console.error('FAILED:', e);
  process.exit(1);
});
