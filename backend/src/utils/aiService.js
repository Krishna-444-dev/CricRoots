const axios = require('axios');

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://ai-engine:5001';

// Only the two win-probability-backed calls remain. recommendBatsman/recommendBowler/
// recommendFielding/healthCheck were removed in E1 (2026-08-19): they had zero call sites in
// backend/src, and the two models behind the first two were trained on uniform random integers
// (documentation/ai-engine-audit.md §1b). The fielding recommender was reached by nothing at all -
// FieldingPlan.tsx uses insightsRoutes.js's /batsman/:playerId/fielding-plan, an unrelated real
// backend feature.
// The wire payload, built from a chase state produced by services/matchStateFeatures.js.
//
// No `|| 20` / `|| 150` defaults. Those existed at every call site and were the mechanism by which
// a first-innings ball still produced a fully-formed win probability: a missing target became 150,
// a missing overs figure became 20, and the model answered confidently about a state nobody had.
// Callers now pass a complete chase state or do not call at all (E2), so an incomplete state is a
// programming error and is reported as one rather than filled in.
//
// opposition_strength and pitch_type were removed with the models they fed (E1). They were
// hardcoded to 7 and 1 at all three call sites, so those two features never varied in production.
function chasePayload(matchData) {
  const payload = {
    overs_remaining: matchData?.oversRemaining,
    wickets_down: matchData?.wicketsDown,
    current_run_rate: matchData?.currentRunRate,
    target_score: matchData?.targetScore
  };
  const missing = Object.entries(payload)
    .filter(([, v]) => typeof v !== 'number' || Number.isNaN(v))
    .map(([k]) => k);
  if (missing.length) {
    throw new Error(`Incomplete chase state, missing: ${missing.join(', ')}`);
  }
  return payload;
}

class AIService {
  /**
   * Win probability for the chasing team. `matchData` must be a chase state from
   * services/matchStateFeatures.js - null states are the caller's job to filter, not this one's.
   */
  static async getWinProbability(matchData) {
    try {
      const response = await axios.post(
        `${AI_ENGINE_URL}/api/recommendations/win-probability`,
        chasePayload(matchData),
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      console.error('AI Service Error (Win Probability):', error.message);
      return { success: false, message: 'Failed to get win probability' };
    }
  }

  /**
   * Win probability plus status label and advice string, for the same chase state.
   */
  static async getTacticalAdvice(matchData) {
    try {
      const response = await axios.post(
        `${AI_ENGINE_URL}/api/recommendations/tactical-advisor`,
        chasePayload(matchData),
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      console.error('AI Service Error (Tactical Advisor):', error.message);
      return { success: false, message: 'Failed to get tactical advice' };
    }
  }
}

module.exports = AIService;
