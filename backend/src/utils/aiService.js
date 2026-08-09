const axios = require('axios');

const AI_ENGINE_URL = process.env.AI_ENGINE_URL || 'http://ai-engine:5001';

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
   * Get batsman recommendation
   */
  static async recommendBatsman(matchData) {
    try {
      const response = await axios.post(
        `${AI_ENGINE_URL}/api/recommendations/batsman`,
        {
          current_run_rate: matchData.currentRunRate || 6,
          wickets_down: matchData.wicketsDown || 2,
          overs_remaining: matchData.oversRemaining || 15,
          opposition_strength: matchData.oppositionStrength || 7
        },
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      console.error('AI Service Error (Batsman):', error.message);
      return { success: false, message: 'Failed to get batsman recommendation' };
    }
  }

  /**
   * Get bowler recommendation
   */
  static async recommendBowler(matchData) {
    try {
      const response = await axios.post(
        `${AI_ENGINE_URL}/api/recommendations/bowler`,
        {
          current_run_rate: matchData.currentRunRate || 6,
          wickets_down: matchData.wicketsDown || 2,
          overs_remaining: matchData.oversRemaining || 15,
          pitch_type: matchData.pitchType || 1
        },
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      console.error('AI Service Error (Bowler):', error.message);
      return { success: false, message: 'Failed to get bowler recommendation' };
    }
  }

  /**
   * Get fielding position recommendation
   */
  static async recommendFielding(playerData, batsmanData) {
    try {
      const response = await axios.post(
        `${AI_ENGINE_URL}/api/recommendations/fielding`,
        {
          player_data: {
            fielding_ability: playerData.fieldingAbility || 8,
            throwing_accuracy: playerData.throwingAccuracy || 7,
            speed_agility: playerData.speedAgility || 8,
            catching_ability: playerData.catchingAbility || 8
          },
          batsman_data: {
            shot_tendency: batsmanData.shotTendency || 5
          }
        },
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      console.error('AI Service Error (Fielding):', error.message);
      return { success: false, message: 'Failed to get fielding recommendation' };
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

  /**
   * Check AI engine health
   */
  static async healthCheck() {
    try {
      const response = await axios.get(
        `${AI_ENGINE_URL}/api/recommendations/health`,
        { timeout: 5000 }
      );
      return response.data;
    } catch (error) {
      console.error('AI Service Health Check Failed:', error.message);
      return { status: 'unhealthy', message: 'AI Engine not responding' };
    }
  }
}

module.exports = AIService;
