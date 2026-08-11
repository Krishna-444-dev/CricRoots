// Parses a spoken transcript (e.g. "yorker, off stump, driven through covers for four") into
// the same fields the tap-based scoring UI already collects. Pure function, no React/DOM
// dependency - the transcript comes from VoiceBallInput's SpeechRecognition wrapper.
//
// Deliberately does NOT set fielderId/fielderPosition or open the wicket modal's "new batsman"
// field - those require picking an actual teammate from the roster, which free text can't
// reliably resolve to a specific player id. Voice only fills the fields the tap UI's button
// groups fill; the wicket-confirmation modal (batsman + fielder selection) still requires a
// manual tap either way, exactly as it does today for tap-only scoring.
//
// Matching strategy: word-boundary regex only, longest/most-specific phrases tried before
// shorter single-word ones, and matched text is removed from the working string as it's
// consumed so a later, more general rule can't re-fire on words a more specific rule already
// claimed. This is what keeps "off stump" (a line) from being misread as the wicket type
// "stumped" - "stumped" is only ever matched as the exact whole word "stumped", which never
// appears in "off stump" to begin with, and by the time any single-word rule runs, the phrase
// "off stump" has already been removed from the string. On a genuine ambiguous tie (e.g. bare
// "short" with nothing else nearby - a valid length value on its own, but also a colloquial
// synonym for "bouncer" and a substring of "short of a length"), the longest-phrase-first order
// resolves the compound-phrase case, and a bare leftover "short" maps to the length literally
// named 'short' rather than guessing 'bouncer' - under-matching is preferred over guessing
// wrong, since the scorer sees a "Heard: ..." preview and can tap to fill anything the parser
// left blank.

import { Line, Length, ShotType, ShotZone } from './ballTaxonomy';

export interface ParsedBall {
  runs?: number;
  isWicket?: boolean;
  wicketType?: string;
  isExtra?: boolean;
  extraType?: 'wide' | 'no-ball' | 'bye' | 'leg-bye' | 'penalty';
  line?: Line;
  length?: Length;
  shotType?: ShotType;
  shotZone?: ShotZone;
}

type Setter = (parsed: ParsedBall) => void;

interface Rule {
  pattern: RegExp;
  field: keyof ParsedBall;
  apply: Setter;
}

function wordRule(phrase: string, field: keyof ParsedBall, apply: Setter): Rule {
  // Phrase may contain multiple words separated by plain spaces - escape regex specials
  // (none expected in our phrase list, but safe regardless) and require word boundaries
  // on both ends so "stump" never matches inside "stumped" or vice versa.
  const escaped = phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return { pattern: new RegExp(`\\b${escaped}\\b`), field, apply };
}

// Ordered most-specific (multi-word) to least-specific (single word) WITHIN each field, since
// only ordering relative to same-field rules matters for correctness - different fields never
// conflict with each other.
const RULES: Rule[] = [
  // --- Wicket (multi-word first) ---
  wordRule('run out', 'isWicket', p => { p.isWicket = true; p.wicketType = 'run out'; }),
  wordRule('hit wicket', 'isWicket', p => { p.isWicket = true; p.wicketType = 'hit wicket'; }),
  wordRule('retired hurt', 'isWicket', p => { p.isWicket = true; p.wicketType = 'retired hurt'; }),
  wordRule('retired out', 'isWicket', p => { p.isWicket = true; p.wicketType = 'retired out'; }),
  wordRule('caught behind', 'isWicket', p => { p.isWicket = true; p.wicketType = 'caught'; }),
  wordRule('clean bowled', 'isWicket', p => { p.isWicket = true; p.wicketType = 'bowled'; }),
  wordRule('bowled', 'isWicket', p => { p.isWicket = true; p.wicketType = 'bowled'; }),
  wordRule('caught', 'isWicket', p => { p.isWicket = true; p.wicketType = 'caught'; }),
  wordRule('catch', 'isWicket', p => { p.isWicket = true; p.wicketType = 'caught'; }),
  wordRule('lbw', 'isWicket', p => { p.isWicket = true; p.wicketType = 'lbw'; }),
  wordRule('leg before', 'isWicket', p => { p.isWicket = true; p.wicketType = 'lbw'; }),
  wordRule('stumped', 'isWicket', p => { p.isWicket = true; p.wicketType = 'stumped'; }),

  // --- Line (multi-word first; "wide outside off" must win before bare "wide" = extra) ---
  wordRule('wide outside off', 'line', p => { p.line = 'wide-outside-off'; }),
  wordRule('outside off', 'line', p => { p.line = 'outside-off'; }),
  wordRule('off stump', 'line', p => { p.line = 'off-stump'; }),
  wordRule('middle stump', 'line', p => { p.line = 'middle-stump'; }),
  wordRule('leg stump', 'line', p => { p.line = 'leg-stump'; }),
  wordRule('down the leg side', 'line', p => { p.line = 'down-leg'; }),
  wordRule('down leg', 'line', p => { p.line = 'down-leg'; }),

  // --- Length (multi-word first) ---
  wordRule('full toss', 'length', p => { p.length = 'full-toss'; }),
  wordRule('good length', 'length', p => { p.length = 'good-length'; }),
  wordRule('short of a good length', 'length', p => { p.length = 'short-of-good-length'; }),
  wordRule('short of a length', 'length', p => { p.length = 'short-of-good-length'; }),
  wordRule('back of a length', 'length', p => { p.length = 'short-of-good-length'; }),
  wordRule('yorker', 'length', p => { p.length = 'yorker'; }),
  wordRule('bouncer', 'length', p => { p.length = 'bouncer'; }),
  wordRule('bumper', 'length', p => { p.length = 'bouncer'; }),
  wordRule('full', 'length', p => { p.length = 'full'; }),
  wordRule('short', 'length', p => { p.length = 'short'; }),

  // --- Shot type (multi-word first) ---
  wordRule('cover drive', 'shotType', p => { p.shotType = 'drive'; p.shotZone = 'cover'; }),
  wordRule('off drive', 'shotType', p => { p.shotType = 'drive'; p.shotZone = 'mid-off'; }),
  wordRule('on drive', 'shotType', p => { p.shotType = 'drive'; p.shotZone = 'mid-on'; }),
  wordRule('square cut', 'shotType', p => { p.shotType = 'cut'; p.shotZone = 'point'; }),
  wordRule('late cut', 'shotType', p => { p.shotType = 'cut'; p.shotZone = 'third-man'; }),
  wordRule('reverse scoop', 'shotType', p => { p.shotType = 'reverse-scoop'; }),
  wordRule('pull shot', 'shotType', p => { p.shotType = 'pull-hook'; }),
  wordRule('hook shot', 'shotType', p => { p.shotType = 'pull-hook'; }),
  wordRule('sweep shot', 'shotType', p => { p.shotType = 'sweep'; }),
  wordRule('leg glance', 'shotType', p => { p.shotType = 'flick-glance'; p.shotZone = 'fine-leg'; }),
  wordRule('driven', 'shotType', p => { p.shotType = 'drive'; }),
  wordRule('drive', 'shotType', p => { p.shotType = 'drive'; }),
  wordRule('cut', 'shotType', p => { p.shotType = 'cut'; }),
  wordRule('pulled', 'shotType', p => { p.shotType = 'pull-hook'; }),
  wordRule('hooked', 'shotType', p => { p.shotType = 'pull-hook'; }),
  wordRule('swept', 'shotType', p => { p.shotType = 'sweep'; }),
  wordRule('lofted', 'shotType', p => { p.shotType = 'loft'; }),
  wordRule('lofted over', 'shotType', p => { p.shotType = 'loft'; }),
  wordRule('flicked', 'shotType', p => { p.shotType = 'flick-glance'; }),
  wordRule('glanced', 'shotType', p => { p.shotType = 'flick-glance'; }),
  wordRule('edged', 'shotType', p => { p.shotType = 'edge'; }),
  wordRule('edge', 'shotType', p => { p.shotType = 'edge'; }),
  wordRule('defended', 'shotType', p => { p.shotType = 'defensive'; }),
  wordRule('blocked', 'shotType', p => { p.shotType = 'defensive'; }),

  // --- Shot zone (multi-word first) ---
  wordRule('fine leg', 'shotZone', p => { p.shotZone = 'fine-leg'; }),
  wordRule('square leg', 'shotZone', p => { p.shotZone = 'square-leg'; }),
  wordRule('mid wicket', 'shotZone', p => { p.shotZone = 'mid-wicket'; }),
  wordRule('midwicket', 'shotZone', p => { p.shotZone = 'mid-wicket'; }),
  wordRule('mid on', 'shotZone', p => { p.shotZone = 'mid-on'; }),
  wordRule('mid off', 'shotZone', p => { p.shotZone = 'mid-off'; }),
  wordRule('third man', 'shotZone', p => { p.shotZone = 'third-man'; }),
  wordRule('covers', 'shotZone', p => { p.shotZone = 'cover'; }),
  wordRule('cover', 'shotZone', p => { p.shotZone = 'cover'; }),
  wordRule('point', 'shotZone', p => { p.shotZone = 'point'; }),

  // --- Extras (before bare run-word rules so "wide" isn't mistaken for anything else) ---
  wordRule('no ball', 'isExtra', p => { p.isExtra = true; p.extraType = 'no-ball'; }),
  wordRule('leg byes', 'isExtra', p => { p.isExtra = true; p.extraType = 'leg-bye'; }),
  wordRule('leg bye', 'isExtra', p => { p.isExtra = true; p.extraType = 'leg-bye'; }),
  wordRule('byes', 'isExtra', p => { p.isExtra = true; p.extraType = 'bye'; }),
  wordRule('bye', 'isExtra', p => { p.isExtra = true; p.extraType = 'bye'; }),
  wordRule('wide', 'isExtra', p => { p.isExtra = true; p.extraType = 'wide'; }),

  // --- Runs / outcome words ---
  wordRule('no run', 'runs', p => { p.runs = 0; }),
  wordRule('dot ball', 'runs', p => { p.runs = 0; }),
  wordRule('dot', 'runs', p => { p.runs = 0; }),
  wordRule('single', 'runs', p => { p.runs = 1; }),
  wordRule('one run', 'runs', p => { p.runs = 1; }),
  wordRule('couple', 'runs', p => { p.runs = 2; }),
  wordRule('two runs', 'runs', p => { p.runs = 2; }),
  wordRule('three runs', 'runs', p => { p.runs = 3; }),
  wordRule('boundary', 'runs', p => { p.runs = 4; }),
  wordRule('four', 'runs', p => { p.runs = 4; }),
  wordRule('maximum', 'runs', p => { p.runs = 6; }),
  wordRule('six', 'runs', p => { p.runs = 6; }),
];

/**
 * Parses a spoken transcript into whatever fields it found a confident, unambiguous match
 * for. Fields with no match are simply omitted (never guessed) - the caller (VoiceBallInput's
 * consumer) merges this onto existing UI state and shows the scorer what was heard before
 * anything is submitted.
 */
export function parseBallTranscript(transcript: string): ParsedBall {
  const parsed: ParsedBall = {};
  let remaining = ` ${transcript.toLowerCase().trim()} `;
  const claimedFields = new Set<keyof ParsedBall>();

  for (const rule of RULES) {
    if (claimedFields.has(rule.field)) continue;
    const match = remaining.match(rule.pattern);
    if (!match) continue;

    rule.apply(parsed);
    claimedFields.add(rule.field);
    // Remove the matched phrase so a later, more general rule (for a *different* field)
    // can't spuriously match a word this rule already consumed.
    remaining = remaining.replace(rule.pattern, ' ');
  }

  return parsed;
}
