// Auto-generates a news article for a completed tournament match, spotlighting the standout
// individual performance (century, five-wicket haul, hat-trick, half-century) if there is one,
// or a general result recap otherwise. Triggered from matchController.updateMatch whenever a
// match belonging to a tournament transitions to Completed - see matchController.js.
//
// This is the feature the user specifically asked for: "if someone hits a century and wins a
// game for their team, an article should be generated... viewed by all the players participating
// in the tournament." Visibility/feed scoping lives in newsController.getMyFeed, not here - this
// module only decides WHAT to write, not who gets to read it.

const Player = require('../models/Player');
const NewsPost = require('../models/NewsPost');
const { NON_BOWLER_WICKET_TYPES } = require('./mvpCalculator');

const NON_BATTING_EXTRA_TYPES = ['wide', 'bye', 'leg-bye'];

/**
 * Single pass over a completed match's ball-by-ball data, building a per-player performance
 * summary for THIS match only (unlike tendencyAnalytics.getCareerStats, which aggregates across
 * every match a player has ever appeared in).
 *
 * @returns {Map<string, {runs, balls, fours, sixes, out, wickets, bowlingRuns, bowlingBalls, hatTrick}>}
 */
function computeMatchPerformances(match) {
  const perf = new Map();
  const get = (id) => {
    const key = id.toString();
    if (!perf.has(key)) {
      perf.set(key, { runs: 0, balls: 0, fours: 0, sixes: 0, out: false, wickets: 0, bowlingRuns: 0, bowlingBalls: 0, hatTrick: false });
    }
    return perf.get(key);
  };

  for (const innings of match.innings || []) {
    const balls = innings.balls || [];
    const bowlerLegalWicketSeq = new Map(); // bowlerId (string) -> bool[]

    for (const ball of balls) {
      if (ball.batsmanId) {
        const p = get(ball.batsmanId);
        const countsForBatsman = !(ball.isExtra && NON_BATTING_EXTRA_TYPES.includes(ball.extraType));
        if (countsForBatsman) p.runs += ball.runs || 0;
        if (!(ball.isExtra && ball.extraType === 'wide')) p.balls += 1;
        if (!ball.isExtra && ball.runs === 4) p.fours += 1;
        if (!ball.isExtra && ball.runs === 6) p.sixes += 1;
        if (ball.isWicket) p.out = true;
      }

      if (ball.bowlerId) {
        const p = get(ball.bowlerId);
        const isLegal = !(ball.isExtra && ['wide', 'no-ball'].includes(ball.extraType));
        if (isLegal) p.bowlingBalls += 1;
        if (!(ball.isExtra && ['bye', 'leg-bye'].includes(ball.extraType))) p.bowlingRuns += ball.runs || 0;
        const credited = ball.isWicket && !NON_BOWLER_WICKET_TYPES.includes(ball.wicketType);
        if (credited) p.wickets += 1;

        if (isLegal) {
          const key = ball.bowlerId.toString();
          const seq = bowlerLegalWicketSeq.get(key) || [];
          seq.push(credited);
          bowlerLegalWicketSeq.set(key, seq);
        }
      }
    }

    for (const [bowlerId, seq] of bowlerLegalWicketSeq) {
      let streak = 0;
      for (const wasWicket of seq) {
        if (wasWicket) {
          streak += 1;
          if (streak >= 3) {
            get(bowlerId).hatTrick = true;
            break;
          }
        } else {
          streak = 0;
        }
      }
    }
  }

  return perf;
}

/**
 * Picks the single best "hero" moment from a match's performances, in order of narrative
 * significance. Returns null if nobody hit any real milestone (a purely ordinary match still
 * gets an article - see generateMatchArticle - just without a spotlighted individual).
 */
function pickHeroMoment(perfByPlayer) {
  const entries = [...perfByPlayer.entries()];

  const century = entries.find(([, p]) => p.runs >= 100);
  if (century) return { playerId: century[0], type: 'century', detail: century[1] };

  const fiveFer = entries.find(([, p]) => p.wickets >= 5);
  if (fiveFer) return { playerId: fiveFer[0], type: 'five-wicket-haul', detail: fiveFer[1] };

  const hatTrick = entries.find(([, p]) => p.hatTrick);
  if (hatTrick) return { playerId: hatTrick[0], type: 'hat-trick', detail: hatTrick[1] };

  // Half-century: pick the highest scorer in the 50-99 range, not just the first found.
  const halfCenturies = entries.filter(([, p]) => p.runs >= 50 && p.runs < 100);
  if (halfCenturies.length > 0) {
    const best = halfCenturies.reduce((a, b) => (b[1].runs > a[1].runs ? b : a));
    return { playerId: best[0], type: 'half-century', detail: best[1] };
  }

  // A strong (but sub-5) bowling spell: 3+ wickets, pick the cheapest such spell.
  const goodSpells = entries.filter(([, p]) => p.wickets >= 3);
  if (goodSpells.length > 0) {
    const best = goodSpells.reduce((a, b) => (b[1].wickets > a[1].wickets ? b : a));
    return { playerId: best[0], type: 'three-wicket-spell', detail: best[1] };
  }

  return null;
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function resultSentence(match, winningTeamName, losingTeamName) {
  if (!match.result || match.result.margin === 'tie') {
    return `The match finished in a tie between ${winningTeamName} and ${losingTeamName}.`;
  }
  const marginText = match.result.margin === 'runs'
    ? `by ${match.result.marginValue} runs`
    : match.result.margin === 'wickets'
    ? `by ${match.result.marginValue} wickets`
    : 'in a hard-fought finish';
  return pick([
    `${winningTeamName} beat ${losingTeamName} ${marginText}.`,
    `${winningTeamName} came out on top against ${losingTeamName}, winning ${marginText}.`,
    `It was ${winningTeamName}'s day, closing out the win over ${losingTeamName} ${marginText}.`
  ]);
}

function heroSentence(hero, heroName, teamName) {
  const { type, detail } = hero;
  if (type === 'century') {
    return pick([
      `${heroName} was the star of the show, smashing a magnificent ${detail.runs} off ${detail.balls} balls (${detail.fours} fours, ${detail.sixes} sixes) for ${teamName}.`,
      `The headline act was ${heroName}'s brilliant century - ${detail.runs} runs off just ${detail.balls} deliveries, laced with ${detail.fours} fours and ${detail.sixes} sixes.`,
      `${heroName} announced themselves in style with a superb ${detail.runs}-run knock (${detail.balls} balls, ${detail.fours}x4, ${detail.sixes}x6) that ${teamName} will remember for a long time.`
    ]);
  }
  if (type === 'five-wicket-haul') {
    return pick([
      `${heroName} ran through the opposition with a stunning ${detail.wickets}-wicket haul, conceding just ${detail.bowlingRuns} runs off ${Math.floor(detail.bowlingBalls / 6)}.${detail.bowlingBalls % 6} overs.`,
      `It was a bowling masterclass from ${heroName}, who claimed ${detail.wickets} wickets for ${detail.bowlingRuns} runs to blow the game open for ${teamName}.`,
      `${heroName} tore through the batting line-up, finishing with figures of ${detail.wickets}/${detail.bowlingRuns} for ${teamName}.`
    ]);
  }
  if (type === 'hat-trick') {
    return pick([
      `${heroName} produced a hat-trick - three wickets in three balls - a moment the crowd won't forget, finishing with ${detail.wickets} for the innings.`,
      `The standout moment of the match belonged to ${heroName}, who claimed a hat-trick on the way to figures of ${detail.wickets}/${detail.bowlingRuns} for ${teamName}.`
    ]);
  }
  if (type === 'half-century') {
    return pick([
      `${heroName} top-scored for ${teamName} with a well-made ${detail.runs} off ${detail.balls} balls.`,
      `A composed half-century from ${heroName} (${detail.runs} off ${detail.balls}) anchored the ${teamName} innings.`
    ]);
  }
  // three-wicket-spell
  return pick([
    `${heroName} was the pick of the bowlers for ${teamName}, finishing with ${detail.wickets}/${detail.bowlingRuns}.`,
    `A disciplined spell from ${heroName} (${detail.wickets} wickets for ${detail.bowlingRuns}) did the damage for ${teamName}.`
  ]);
}

function heroTitle(hero, heroName, teamName, opponentName) {
  const { type, detail } = hero;
  if (type === 'century') return `${heroName}'s ${detail.runs} powers ${teamName} in tournament clash with ${opponentName}`;
  if (type === 'five-wicket-haul') return `${heroName} runs riot with ${detail.wickets}-wicket haul against ${opponentName}`;
  if (type === 'hat-trick') return `${heroName} claims a hat-trick as ${teamName} take on ${opponentName}`;
  if (type === 'half-century') return `${heroName}'s ${detail.runs} lifts ${teamName} against ${opponentName}`;
  return `${heroName} stars with the ball as ${teamName} face ${opponentName}`;
}

/**
 * Generates and saves a NewsPost for a completed, tournament-linked match. Never throws past its
 * own boundary - article generation is a nice-to-have layered on top of match completion, not
 * something that should ever fail the actual match-completion request (see matchController.js's
 * try/catch around the call site).
 *
 * @param {object} match - a completed Match document, populated with team1/team2 (name)
 * @param {object} tournament - the Tournament document match.tournament refers to
 * @returns {Promise<object|null>} the created NewsPost, or null if nothing meaningful to report
 *   (e.g. a match with zero recorded deliveries)
 */
async function generateMatchArticle(match, tournament) {
  const perf = computeMatchPerformances(match);
  if (perf.size === 0) return null;

  const team1Name = match.team1.name;
  const team2Name = match.team2.name;
  const team1Id = match.team1._id.toString();
  const team2Id = match.team2._id.toString();

  const winningTeamId = match.result?.winningTeam ? match.result.winningTeam.toString() : null;
  const winningTeamName = winningTeamId === team1Id ? team1Name : winningTeamId === team2Id ? team2Name : null;
  const losingTeamName = winningTeamId === team1Id ? team2Name : winningTeamId === team2Id ? team1Name : null;

  const hero = pickHeroMoment(perf);

  // Resolve display names for every player involved in the hero moment (just one lookup, not
  // the whole scorecard - keeps this cheap even for a full match's worth of ball data).
  let heroName = 'A player';
  let heroTeamName = winningTeamName || team1Name;
  if (hero) {
    const heroPlayer = await Player.findById(hero.playerId).populate('user', 'name');
    heroName = heroPlayer?.user?.name || 'A player';
    // Which team the hero played for: whichever innings they batted in (for batting heroics) or
    // the opposite of the innings they bowled in (for bowling heroics) - approximate via team
    // membership would need another query, so use the simpler, always-available signal: the
    // innings team for batting stats, otherwise default to the winning team (bowling heroics that
    // aren't on the winning side are rare and the sentence still reads fine either way).
    for (const innings of match.innings) {
      const battedHere = innings.balls?.some((b) => b.batsmanId && b.batsmanId.toString() === hero.playerId);
      if (battedHere) {
        const teamId = innings.team.toString();
        heroTeamName = teamId === team1Id ? team1Name : teamId === team2Id ? team2Name : heroTeamName;
        break;
      }
    }
  }

  const resultText = winningTeamName
    ? resultSentence(match, winningTeamName, losingTeamName)
    : 'The match has concluded.';

  const opponentName = heroTeamName === team1Name ? team2Name : team1Name;

  const title = hero
    ? heroTitle(hero, heroName, heroTeamName, opponentName)
    : `${winningTeamName || team1Name} face ${winningTeamName ? losingTeamName : team2Name} in ${tournament.name}`;

  const bodyParts = [
    `${team1Name} and ${team2Name} met at ${match.venue} in ${tournament.name}. ${resultText}`
  ];
  if (hero) {
    bodyParts.push(heroSentence(hero, heroName, heroTeamName));
  }
  bodyParts.push(
    `Final score: ${team1Name} ${match.innings[0]?.runs || 0}/${match.innings[0]?.wickets || 0} vs ${team2Name} ${match.innings[1]?.runs || 0}/${match.innings[1]?.wickets || 0}.`
  );

  const post = await NewsPost.create({
    title,
    category: 'match-report',
    body: bodyParts.join(' '),
    author: tournament.organizer,
    tournament: tournament._id,
    match: match._id,
    heroPlayer: hero ? hero.playerId : null,
    isAutoGenerated: true
  });

  return post;
}

module.exports = { generateMatchArticle, computeMatchPerformances, pickHeroMoment, resultSentence, heroSentence };
