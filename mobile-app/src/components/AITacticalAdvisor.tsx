import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Card, ProgressBar } from 'react-native-paper';
import { colors } from '../theme';

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
      // Refresh AI insights every 30 seconds during live match
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
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <Card style={styles.errorCard}>
        <Card.Content>
          <Text style={styles.errorText}>{error}</Text>
        </Card.Content>
      </Card>
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
        return colors.primary;
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
    <ScrollView style={styles.container}>
      <Card style={styles.mainCard}>
        <Card.Content>
          <View style={styles.headerRow}>
            <Text style={styles.title}>AI Tactical Advisor</Text>
            <Text style={styles.emoji}>{getStatusEmoji(aiInsights.match_status)}</Text>
          </View>

          {/* Win Probability Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Win Probability</Text>
            <View style={styles.probabilityContainer}>
              <ProgressBar
                progress={aiInsights.win_probability}
                color={getStatusColor(aiInsights.match_status)}
                style={styles.progressBar}
              />
              <Text style={[styles.probabilityText, { color: getStatusColor(aiInsights.match_status) }]}>
                {(aiInsights.win_probability * 100).toFixed(1)}%
              </Text>
            </View>
            <Text style={styles.statusBadge}>
              Status: <Text style={[styles.statusText, { color: getStatusColor(aiInsights.match_status) }]}>
                {aiInsights.match_status}
              </Text>
            </Text>
          </View>

          {/* Tactical Advice Section */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Strategic Advice</Text>
            <View style={styles.adviceBox}>
              <Text style={styles.adviceText}>
                {aiInsights.tactical_advice}
              </Text>
            </View>
          </View>

          {/* Key Recommendations */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Key Recommendations</Text>
            <View style={styles.recommendationsRow}>
              <View style={styles.recommendationCard}>
                <Text style={styles.recommendationLabel}>Next Batsman</Text>
                <Text style={styles.recommendationValue}>
                  Player #{aiInsights.key_recommendations.batsman}
                </Text>
              </View>
              <View style={styles.recommendationCard}>
                <Text style={styles.recommendationLabel}>Next Bowler</Text>
                <Text style={styles.recommendationValue}>
                  Player #{aiInsights.key_recommendations.bowler}
                </Text>
              </View>
            </View>
          </View>

          {/* Refresh Button */}
          <View style={styles.refreshButtonContainer}>
            <Text style={styles.refreshText}>
              Updates automatically every 30 seconds
            </Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 12,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorCard: {
    backgroundColor: '#ffebee',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorText: {
    color: '#C62828',
    fontSize: 14,
  },
  mainCard: {
    backgroundColor: 'white',
    borderRadius: 12,
    elevation: 3,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  emoji: {
    fontSize: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 10,
  },
  probabilityContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
  },
  probabilityText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  statusBadge: {
    fontSize: 13,
    color: '#666',
  },
  statusText: {
    fontWeight: '700',
  },
  adviceBox: {
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  adviceText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#333',
  },
  recommendationsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  recommendationCard: {
    flex: 1,
    backgroundColor: '#f0f7ff',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  recommendationLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 6,
  },
  recommendationValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  refreshButtonContainer: {
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  refreshText: {
    fontSize: 12,
    color: '#999',
  },
});

export default AITacticalAdvisor;
