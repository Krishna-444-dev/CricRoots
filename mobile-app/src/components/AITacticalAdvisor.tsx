import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from 'react-native';
import { Card, ProgressBar } from 'react-native-paper';
import { useMatchWebSocket } from '../hooks/useMatchWebSocket';
import { colors } from '../theme';

interface AITacticalAdvisorProps {
  matchId: string;
  userId: string;
  token: string;
  isLive: boolean;
}

export const AITacticalAdvisor: React.FC<AITacticalAdvisorProps> = ({
  matchId,
  userId,
  token,
  isLive
}) => {
  const { isConnected, error, aiInsights } = useMatchWebSocket({
    matchId,
    userId,
    token,
    enabled: isLive
  });

  if (!isLive) {
    return null;
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

  if (!isConnected || !aiInsights) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={styles.loadingText}>
          {!isConnected ? 'Connecting to live updates...' : 'Loading AI insights...'}
        </Text>
      </View>
    );
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

          {/* Connection Status */}
          <View style={styles.connectionStatus}>
            <View style={[styles.statusDot, { backgroundColor: isConnected ? '#4CAF50' : '#FF9800' }]} />
            <Text style={styles.connectionText}>
              {isConnected ? 'Live Updates' : 'Reconnecting...'}
            </Text>
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

          {/* Live Status Footer */}
          <View style={styles.liveFooter}>
            <Text style={styles.liveText}>
              🔴 Live - Updates in real-time
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
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#666',
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
    marginBottom: 12,
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
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  connectionText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666',
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
  liveFooter: {
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  liveText: {
    fontSize: 12,
    color: '#F44336',
    fontWeight: '600',
  },
});

export default AITacticalAdvisor;
