// Turns a single ball's structured scoring data (runs, wicket, extras, and the optional
// line/length/shot-type/shot-zone tagging) into a natural-language commentary sentence.
//
// Every branch has a generic fallback so untagged balls - the common case before voice input
// makes full tagging practical on every delivery - still get *some* commentary, not blank text.
// Generic fallbacks are genuinely separate templates, not the detailed templates with blank
// interpolations, so a missing shotType/shotZone never produces a malformed sentence.

const LENGTH_LABELS = {
  'full-toss': 'a full toss',
  yorker: 'a yorker',
  full: 'a full ball',
  'good-length': 'a good-length ball',
  'short-of-good-length': 'a back-of-a-length ball',
  short: 'a short ball',
  bouncer: 'a bouncer'
};

const LINE_LABELS = {
  'wide-outside-off': 'wide of off stump',
  'outside-off': 'outside off stump',
  'off-stump': 'on off stump',
  'middle-stump': 'on middle stump',
  'leg-stump': 'on leg stump',
  'down-leg': 'down the leg side'
};

const SHOT_VERBS = {
  defensive: 'defends',
  drive: 'drives',
  cut: 'cuts',
  'pull-hook': 'pulls',
  sweep: 'sweeps',
  'flick-glance': 'flicks',
  loft: 'lofts',
  'reverse-scoop': 'reverse-scoops',
  edge: 'edges',
  other: 'plays'
};

// Explicit past-tense forms - several of these are irregular (cut/swept) or would double
// a silent trailing 'e' (drive -> "driveed") if derived mechanically from SHOT_VERBS via a
// naive s-stripping regex, so they're spelled out rather than computed.
const SHOT_VERBS_PAST = {
  defensive: 'defended',
  drive: 'drove',
  cut: 'cut',
  'pull-hook': 'pulled',
  sweep: 'swept',
  'flick-glance': 'flicked',
  loft: 'lofted',
  'reverse-scoop': 'reverse-scooped',
  edge: 'edged',
  other: 'played'
};

const ZONE_LABELS = {
  'fine-leg': 'fine leg',
  'square-leg': 'square leg',
  'mid-wicket': 'mid-wicket',
  'mid-on': 'mid-on',
  'mid-off': 'mid-off',
  cover: 'the covers',
  point: 'point',
  'third-man': 'third man'
};

function pick(options) {
  return options[Math.floor(Math.random() * options.length)];
}

function lengthLabel(length) {
  return LENGTH_LABELS[length] || null;
}

function lineLabel(line) {
  return LINE_LABELS[line] || null;
}

function zoneLabel(zone) {
  return ZONE_LABELS[zone] || null;
}

function pluralRuns(runs) {
  return runs === 1 ? '1 run' : `${runs} runs`;
}

/**
 * Describes how a batsman got out, weaving in the fielder's name when relevant.
 * Bowled/lbw/hit-wicket/retired have no fielder; caught/stumped/run-out do.
 */
function describeWicket(wicketType, fielderName) {
  switch (wicketType) {
    case 'bowled':
      return 'bowled';
    case 'lbw':
      return 'lbw';
    case 'hit wicket':
      return 'out, hit wicket';
    case 'retired hurt':
      return 'retired hurt';
    case 'retired out':
      return 'retired out';
    case 'caught':
      return fielderName ? `caught by ${fielderName}` : 'caught';
    case 'stumped':
      return fielderName ? `stumped by ${fielderName}` : 'stumped';
    case 'run out':
      return fielderName ? `run out, ${fielderName} with the throw` : 'run out';
    default:
      return wicketType || 'out';
  }
}

// Wicket types the bowler gets no credit for (mirrors NON_BOWLER_WICKET_TYPES used
// elsewhere for stats/MVP) - the lead-in shouldn't credit "the bowler" for these.
const NON_BOWLER_WICKET_TYPES = ['run out', 'retired hurt', 'retired out'];

function generateWicketCommentary(ball, batsman, bowler, fielderName) {
  const dismissal = describeWicket(ball.wicketType, fielderName);
  const len = lengthLabel(ball.length);
  const line = lineLabel(ball.line);
  const detail = len && line ? `${len}, ${line} - ` : len ? `${len} - ` : '';

  if (NON_BOWLER_WICKET_TYPES.includes(ball.wicketType)) {
    return pick([
      `${detail}${batsman} is ${dismissal}!`,
      `OUT! ${detail}${batsman} departs, ${dismissal}.`,
      `Direct hit! ${batsman} is ${dismissal}.`
    ]);
  }

  return pick([
    `${detail}${bowler} strikes! ${batsman} is ${dismissal}!`,
    `OUT! ${detail}${batsman} departs, ${dismissal}.`,
    `That's the breakthrough - ${batsman} is ${dismissal}, off ${bowler}.`,
    `${bowler} gets the wicket! ${batsman} ${dismissal}.`
  ]);
}

function generateBoundaryCommentary(ball, batsman) {
  const runsWord = ball.runs === 6 ? 'SIX' : 'FOUR';
  const verb = SHOT_VERBS[ball.shotType];
  const zone = zoneLabel(ball.shotZone);

  // Edge boundaries get their own phrasing rather than the generic verb templates below -
  // "edges... and gets away with it" reads very differently from a clean, deliberate shot.
  if (ball.shotType === 'edge') {
    return pick([
      `${runsWord}! ${batsman} edges${zone ? ` through ${zone}` : ''}... and gets away with it!`,
      `${batsman} edges it - and gets away with it, ${runsWord === 'SIX' ? 'six' : 'four'} runs.`,
      `Thick edge! ${batsman} gets away with it${zone ? `, races away through ${zone}` : ''} for ${runsWord === 'SIX' ? 'six' : 'four'}.`
    ]);
  }

  if (verb) {
    const pastVerb = SHOT_VERBS_PAST[ball.shotType] || verb;
    return pick([
      `${runsWord}! ${batsman} ${verb}${zone ? ` through ${zone}` : ''}.`,
      `What a shot! ${batsman} ${verb} it away for ${runsWord === 'SIX' ? 'six' : 'four'}.`,
      `${runsWord}! Beautifully ${pastVerb}${zone ? ` past ${zone}` : ''}.`
    ]);
  }

  return pick([
    `${runsWord}! Cracking shot from ${batsman}.`,
    runsWord === 'SIX' ? 'SIX! That\'s out of the park!' : 'FOUR! Races away to the boundary.',
    `${runsWord}! ${batsman} finds the gap.`
  ]);
}

function generateRunsCommentary(ball, batsman) {
  const len = lengthLabel(ball.length);
  const zone = zoneLabel(ball.shotZone);
  const runsWord = pluralRuns(ball.runs);

  if (len || zone) {
    return pick([
      `${len ? `${len[0].toUpperCase()}${len.slice(1)}, ` : ''}${batsman} works it${zone ? ` into the ${zone} gap` : ''} for ${runsWord}.`,
      `${batsman} guides it${zone ? ` past ${zone}` : ''} - ${runsWord} taken.`
    ]);
  }

  return pick([
    `${runsWord} taken.`,
    `They cross for ${runsWord}.`,
    `Quick running there, ${runsWord}.`,
    `${batsman} pushes it for ${runsWord}.`
  ]);
}

function generateDotBallCommentary(ball, batsman, bowler) {
  const len = lengthLabel(ball.length);
  const line = lineLabel(ball.line);

  if (ball.shotType === 'defensive' && len) {
    return pick([
      `${len[0].toUpperCase()}${len.slice(1)}, ${batsman} defends solidly.`,
      `${batsman} gets behind ${len} and blocks it out.`
    ]);
  }

  if (len || line) {
    return pick([
      `${len ? `${len[0].toUpperCase()}${len.slice(1)}` : 'Good ball'}${line ? `, ${line}` : ''} - no run.`,
      `${bowler} beats the bat! No run.`
    ]);
  }

  return pick([
    'Dot ball.',
    'No run.',
    `${bowler} to ${batsman}, no run.`,
    'Solid defence, no run.'
  ]);
}

function generateExtraCommentary(ball) {
  const runsWord = pluralRuns(ball.runs || 0);
  switch (ball.extraType) {
    case 'wide':
      return pick([`Wide down the leg side, ${runsWord}.`, 'Umpire signals wide.', `Called wide, ${runsWord} added.`]);
    case 'no-ball':
      return pick(['No ball! Free hit coming up.', 'Overstepped - no ball called.']);
    case 'bye':
      return pick([`Byes taken, ${runsWord} added.`, `They sneak through for ${runsWord}, byes.`]);
    case 'leg-bye':
      return pick([`Leg byes, ${runsWord}.`, `Off the pads for ${runsWord}, leg byes.`]);
    case 'penalty':
      return `${runsWord} penalty awarded.`;
    default:
      return `${runsWord} extra.`;
  }
}

/**
 * @param {object} ball - {runs, isWicket, wicketType, isExtra, extraType, line, length, shotType, shotZone}
 * @param {object} context - {batsmanName, bowlerName, fielderName} - all optional
 * @returns {string} a single commentary sentence, never empty
 */
function generateCommentary(ball, context = {}) {
  const batsman = context.batsmanName || 'the batsman';
  const bowler = context.bowlerName || 'the bowler';

  let sentence;
  if (ball.isWicket) {
    sentence = generateWicketCommentary(ball, batsman, bowler, context.fielderName);
  } else if (ball.isExtra && ball.extraType && ball.extraType !== 'none') {
    sentence = generateExtraCommentary(ball);
  } else if (ball.runs === 4 || ball.runs === 6) {
    sentence = generateBoundaryCommentary(ball, batsman);
  } else if (ball.runs > 0) {
    sentence = generateRunsCommentary(ball, batsman);
  } else {
    sentence = generateDotBallCommentary(ball, batsman, bowler);
  }

  // Every template above is written to read naturally mid-sentence when interpolated,
  // but some start with a lowercase default name ("the bowler...") - capitalize the
  // first letter unconditionally so every returned sentence is well-formed regardless
  // of which template/branch produced it.
  return sentence.charAt(0).toUpperCase() + sentence.slice(1);
}

module.exports = { generateCommentary };
