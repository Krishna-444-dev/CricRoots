import React, { useEffect, useState } from 'react';
import styles from './AITacticalAdvisor.module.css';

interface AIInsight {
  match_status: string;
  win_probability: number;
  tactical_advice: string;
  key_recommendations: {
    batsman: number;
    bowler: number;
  };
}

interface AITacticalAdvisorProps {
  matchId: string;
  isLive: boolean;
}

export const AITacticalAdvisor: React.FC<AITacticalAdvisorProps> = ({ matchId, isLive }) => {
  const [aiInsights, setAiInsights] = useState<AIInsight | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isLive) {
      fetchAIInsights();
      const interval = setInterval(fetchAIInsights, 30000);
      return () => clearInterval(interval);
    }
  }, [matchId, isLive]);

  const fetchAIInsights = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/matches/${matchId}/ai-insights`);
      const data = await response.json();
      
      if (data.success) {
        setAiInsights(data.aiInsights);
        setError(null);
      } else {
        setError('Failed to fetch AI insights');
      }
    } catch (err) {
      setError('Error fetching AI insights');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (!isLive) {
    return null;
  }

  if (loading && !aiInsights) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>Loading AI Insights...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <p className={styles.errorText}>{error}</p>
      </div>
    );
  }

  if (!aiInsights) {
    return null;
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Dominant':
        return '#4CAF50';
      case 'Balanced':
        return '#FF9800';
      case 'Challenging':
        return '#F44336';
      default:
        return '#2196F3';
    }
  };

  const getStatusEmoji = (status: string) => {
    switch (status) {
      case 'Dominant':
        return '💪';
      case 'Balanced':
        return '⚖️';
      case 'Challenging':
        return '⚠️';
      default:
        return '📊';
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            <span>{getStatusEmoji(aiInsights.match_status)}</span>
            AI Tactical Advisor
          </h2>
        </div>

        {/* Win Probability Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Win Probability</h3>
          <div className={styles.probabilityContainer}>
            <div className={styles.progressBarWrapper}>
              <div
                className={styles.progressBar}
                style={{
                  width: `${aiInsights.win_probability * 100}%`,
                  backgroundColor: getStatusColor(aiInsights.match_status),
                }}
              ></div>
            </div>
            <p className={styles.probabilityText} style={{ color: getStatusColor(aiInsights.match_status) }}>
              {(aiInsights.win_probability * 100).toFixed(1)}%
            </p>
          </div>
          <p className={styles.statusBadge}>
            Status: <span style={{ color: getStatusColor(aiInsights.match_status), fontWeight: 'bold' }}>
              {aiInsights.match_status}
            </span>
          </p>
        </div>

        {/* Tactical Advice Section */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Strategic Advice</h3>
          <div className={styles.adviceBox}>
            <p className={styles.adviceText}>{aiInsights.tactical_advice}</p>
          </div>
        </div>

        {/* Key Recommendations */}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>Key Recommendations</h3>
          <div className={styles.recommendationsGrid}>
            <div className={styles.recommendationCard}>
              <p className={styles.recommendationLabel}>Next Batsman</p>
              <p className={styles.recommendationValue}>
                Player #{aiInsights.key_recommendations.batsman}
              </p>
            </div>
            <div className={styles.recommendationCard}>
              <p className={styles.recommendationLabel}>Next Bowler</p>
              <p className={styles.recommendationValue}>
                Player #{aiInsights.key_recommendations.bowler}
              </p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={styles.footer}>
          <p className={styles.footerText}>Updates automatically every 30 seconds</p>
        </div>
      </div>
    </div>
  );
};

export default AITacticalAdvisor;
