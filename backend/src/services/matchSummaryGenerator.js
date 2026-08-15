// Generates a short natural-language recap for a completed match, shown directly on the match's
// own page (Info tab) once it's done - the "Summary" CricClubs shows after a match completes.
// Distinct from matchArticleGenerator.js's generateMatchArticle: that one requires a Tournament
// (writes a NewsPost for the tournament's participant feed, headline-style, hero-focused) and
// runs for tournament matches only. This one has no tournament dependency, runs for every
// completed match, and is stored directly on Match.summary rather than a separate document.
// Reuses the same performance-computation and sentence-building building blocks so both features
// read in a consistent voice rather than duplicating similar-but-drifting prose logic.
const Player = require('../models/Player');
const { computeMatchPerformances, pickHeroMoment, resultSentence, heroSentence } = require('./matchArticleGenerator');

/**
 * @param {object} match - a completed Match document, populated with team1/team2 (name)
 * @returns {Promise<string>} the summary text, or '' if the match has no recorded deliveries
 *   (nothing meaningful to summarize yet)
 */
async function generateMatchSummary(match) {
  const perf = computeMatchPerformances(match);
  if (perf.size === 0) return '';

  const team1Name = match.team1.name;
  const team2Name = match.team2.name;
  const team1Id = match.team1._id.toString();
  const team2Id = match.team2._id.toString();

  const winningTeamId = match.result?.winningTeam ? match.result.winningTeam.toString() : null;
  const winningTeamName = winningTeamId === team1Id ? team1Name : winningTeamId === team2Id ? team2Name : null;
  const losingTeamName = winningTeamId === team1Id ? team2Name : winningTeamId === team2Id ? team1Name : null;

  const hero = pickHeroMoment(perf);

  // Same approximation generateMatchArticle uses: the hero's team is whichever innings they
  // batted in, falling back to the winning team for a bowling-only hero (rare enough that the
  // sentence still reads fine either way without a second roster lookup).
  let heroName = 'A player';
  let heroTeamName = winningTeamName || team1Name;
  if (hero) {
    const heroPlayer = await Player.findById(hero.playerId).populate('user', 'name');
    heroName = heroPlayer?.user?.name || 'A player';
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

  const parts = [`${team1Name} and ${team2Name} met at ${match.venue}. ${resultText}`];
  if (hero) parts.push(heroSentence(hero, heroName, heroTeamName));
  parts.push(
    `Final score: ${team1Name} ${match.innings[0]?.runs || 0}/${match.innings[0]?.wickets || 0} vs ${team2Name} ${match.innings[1]?.runs || 0}/${match.innings[1]?.wickets || 0}.`
  );

  return parts.join(' ');
}

module.exports = { generateMatchSummary };
