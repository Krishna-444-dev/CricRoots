// Seeds the global "trivia of the day" community-feed content (see Trivia.js/
// triviaController.js) - the /api/trivia/current endpoint needs at least one real active item
// to demo, and an empty collection would leave the frontend's trivia card with nothing to show.
// Find-or-create by question text, so re-running this script is safe and never produces
// duplicates.
//
// Usage: MONGO_URI='mongodb://...' node src/scripts/seedTrivia.js

const connectDB = require('../config/database');
const Trivia = require('../models/Trivia');

// 10 real cricket-knowledge questions - rules, terminology, and one long-standing record.
// Kept deliberately "evergreen" (no "current world champion"-style claims that go stale) except
// Brian Lara's 400*, which has stood as the Test-cricket individual-innings record since 2004
// and is about as safe a "record" fact as cricket trivia gets.
const TRIVIA_QUESTIONS = [
  {
    question: 'How many players field for a team on the ground at one time (including the wicketkeeper)?',
    options: ['9', '10', '11', '12'],
    correctIndex: 2,
    explanation: 'Each side fields 11 players at a time, one of whom is the designated wicketkeeper.'
  },
  {
    question: 'What is it called when a bowler dismisses a batsman on three consecutive deliveries?',
    options: ['A triple', 'A hat-trick', 'A treble', 'A trifecta'],
    correctIndex: 1,
    explanation: 'Three wickets on three consecutive balls is a hat-trick - one of the rarest feats a bowler can achieve.'
  },
  {
    question: 'What does "LBW" stand for as a mode of dismissal?',
    options: ['Leg Before Wicket', 'Last Ball Wicket', 'Low Bounce Wide', 'Leg Bye Wicket'],
    correctIndex: 0,
    explanation: "LBW (Leg Before Wicket) is given when the ball would have gone on to hit the stumps but struck the batsman's body first, subject to several conditions in the Laws of Cricket."
  },
  {
    question: 'How many runs does a batting team score when the ball clears the boundary rope without touching the ground?',
    options: ['3', '4', '5', '6'],
    correctIndex: 3,
    explanation: "A ball that clears the boundary on the full (without bouncing) scores six runs; if it touches the ground before crossing the rope, it's four."
  },
  {
    question: 'Who holds the record for the highest individual score in a Test match innings - 400 not out against England in 2004?',
    options: ['Sachin Tendulkar', 'Brian Lara', 'Virender Sehwag', 'Matthew Hayden'],
    correctIndex: 1,
    explanation: 'Brian Lara scored 400 not out for the West Indies against England in Antigua in 2004, the highest individual innings in Test cricket history.'
  },
  {
    question: 'What is an over called if the bowler concedes no runs at all off it?',
    options: ['A dry over', 'A dot over', 'A maiden over', 'A blank over'],
    correctIndex: 2,
    explanation: 'An over in which no runs are scored off the bowler is called a maiden over - a wicket taken in one makes it a "wicket maiden".'
  },
  {
    question: 'In a Twenty20 (T20) innings, what is the maximum number of overs a single bowler is allowed to bowl?',
    options: ['3', '4', '5', '6'],
    correctIndex: 1,
    explanation: 'No bowler may bowl more than four overs in a T20 innings - one-fifth of the full 20-over allocation, the same one-fifth cap used in ODIs (10 of 50).'
  },
  {
    question: "What is it called when a batsman is dismissed for a duck on the very first ball they face?",
    options: ['Golden Duck', 'Diamond Duck', 'Silver Duck', 'Platinum Duck'],
    correctIndex: 0,
    explanation: "A \"golden duck\" is being out off the first ball faced without scoring. A \"diamond duck\" is rarer still - dismissed without facing a single ball, e.g. run out at the non-striker's end."
  },
  {
    question: 'How many overs does each team bat for in a standard, uninterrupted One Day International (ODI)?',
    options: ['20', '40', '50', '60'],
    correctIndex: 2,
    explanation: 'A standard ODI innings is 50 overs per side - the format that gives One Day cricket its name.'
  },
  {
    question: 'Which fielding position stands beside the wicketkeeper to catch fine edges off the bat?',
    options: ['Gully', 'Slip', 'Point', 'Mid-on'],
    correctIndex: 1,
    explanation: "Slip fielders stand next to the wicketkeeper for fine edges; \"gully\" is a little squarer, and \"point\" sits square of the wicket on the off side."
  }
];

async function main() {
  await connectDB();

  let created = 0;
  let skipped = 0;
  for (const q of TRIVIA_QUESTIONS) {
    const existing = await Trivia.findOne({ question: q.question });
    if (existing) {
      skipped += 1;
      continue;
    }
    await Trivia.create({ ...q, isActive: true });
    created += 1;
  }

  console.log(`Trivia seed complete: ${created} created, ${skipped} already present.`);
  process.exit(0);
}

main().catch((error) => {
  console.error('Trivia seed failed:', error);
  process.exit(1);
});
