const axios = require('axios');

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://ai-engine:5001';

// Only the two win-probability-backed calls remain. recommendBatsman/recommendBowler/
// recommendFielding/healthCheck were removed in E1 (2026-08-19): they had zero call sites in
// backend/src, and the two models behind the first two were trained on uniform random integers
// (documentation/ai-engine-audit.md §1b). The fielding recommender was reached by nothing at all -
// FieldingPlan.tsx uses insightsRoutes.js's /batsman/:playerId/fielding-plan, an unrelated real
// backend feature.
class AIService {
  /**
   * Get win probability for the current match situation
   */
  static async getWinProbability(matchData) {
    try {
      const response = await axios.post(
        `${AI_ENGINE_URL}/api/recommendations/win-probability`,
        {
          overs_remaining: matchData.oversRemaining || 20,
          wickets_down: matchData.wicketsDown || 0,
          current_run_rate: matchData.currentRunRate || 0,
          target_score: matchData.targetScore || 150
        },
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      console.error('AI Service Error (Win Probability):', error.message);
      return { success: false, message: 'Failed to get win probability' };
    }
  }

  /**
   * Get comprehensive tactical advisor summary
   */
  static async getTacticalAdvice(matchData) {
    try {
      const response = await axios.post(
        `${AI_ENGINE_URL}/api/recommendations/tactical-advisor`,
        {
          overs_remaining: matchData.oversRemaining || 20,
          wickets_down: matchData.wicketsDown || 0,
          current_run_rate: matchData.currentRunRate || 0,
          target_score: matchData.targetScore || 150,
          opposition_strength: matchData.oppositionStrength || 7,
          pitch_type: matchData.pitchType || 1
        },
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
