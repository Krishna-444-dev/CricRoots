import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { Card, ProgressBar } from 'react-native-paper';
import { useMatchWebSocket } from '../hooks/useMatchWebSocket';
import { api } from '../shared/api/apiClient';
import { colors } from '../theme';

interface AITacticalAdvisorProps {
  matchId: string;
  userId: string;
  token: string;
  isLive: boolean;
}

// Shape of the ai-insights payload, whether it arrives via the WebSocket push or the REST
// fallback below - key_recommendations is present on the wire but deliberately never rendered
// (see the note above the old "Key Recommendations" block that used to live here): it's a raw
// numeric class label from a model trained purely on match-state numbers with zero roster
// awareness, so it never corresponds to any real player.
interface AIInsightData {
  match_status: string;
  win_probability: number;
  tactical_advice: string;
  key_recommendations?: { batsman: number; bowler: number };
}

interface BowlerRecommendation {
  striker: { id: string; name: string };
  recommendation: { playerId: string; name: string; reason: string } | null;
}

export const AITacticalAdvisor: React.FC<AITacticalAdvisorProps> = ({
  matchId,
  userId,
  token,
  isLive
}) => {
  const { isConnected, error, aiInsights: liveInsights, ballRecorded } = useMatchWebSocket({
    matchId,
    userId,
    token,
    enabled: isLive
  });

  // The socket only pushes a fresh insight after the *next* ball is recorded, so opening this
  // panel mid-match with nobody scoring right now left it spinning forever. Fetch the current
  // snapshot once on mount via the REST endpoint; the socket then keeps it fresh as balls land.
  const [initialInsights, setInitialInsights] = useState<AIInsightData | null>(null);
  const [initialLoadFailed, setInitialLoadFailed] = useState(false);

  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    api.matches
      .getAIInsights(matchId)
      .then((data: any) => {
        if (!cancelled && data.success) setInitialInsights(data.aiInsights);
      })
      .catch(() => {
        if (!cancelled) setInitialLoadFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, isLive]);

  // Prefer the live WebSocket value once it exists (it's always more recent than the initial
  // REST snapshot); fall back to the REST snapshot until the first push arrives.
  const aiInsights: AIInsightData | null = (liveInsights as AIInsightData | null) || initialInsights;

  // Real "who should bowl next" recommendation, grounded in the bowling team's actual roster
  // and this app's own matchup/tendency stats (see getNextBowlerRecommendation on the
  // backend) - not the synthetic key_recommendations model that has no roster awareness.
  const [bowlerRec, setBowlerRec] = useState<BowlerRecommendation | null>(null);

  // Re-fetch whenever a new ball lands, not just once on mount - otherwise this stays frozen
  // at whatever it was when the panel first opened even as win_probability keeps updating live
  // beside it (that one arrives via the socket's own 'ai-insights' push; this recommendation
  // has no push equivalent, so `ballRecorded` - which changes identity on every 'ball-recorded'
  // event - stands in as the "something changed, go refetch" trigger).
  useEffect(() => {
    if (!isLive) return;
    let cancelled = false;
    api.matches
      .getNextBowlerRecommendation(matchId)
      .then((data: any) => {
        if (!cancelled && data.success && data.recommendation) setBowlerRec(data);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [matchId, isLive, ballRecorded]);

  if (!isLive) {
    return null;
  }

  // A socket error only means live updates aren't flowing right now - it doesn't mean there's
  // nothing to show. The REST-fetched snapshot (aiInsights) is still valid and worth displaying;
  // only block on the error if there's truly no data to fall back on.
  if (error && !aiInsights) {
    return (
      <Card style={styles.errorCard}>
        <Card.Content>
          <Text style={styles.errorText}>{error}</Text>
        </Card.Content>
      </Card>
    );
  }

  if (!aiInsights) {
    if (initialLoadFailed) {
      return (
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Could not load AI insights. Try again shortly.</Text>
        </View>
      );
    }
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={colors.pitch500} />
        <Text style={styles.loadingText}>Loading AI insights...</Text>
      </View>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Dominant':
        return colors.pitch400;
      case 'Balanced':
        return colors.gold400;
      case 'Challenging':
        return colors.wicket400;
      default:
        return colors.pitch500;
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
    <Card style={styles.mainCard}>
      <Card.Content>
        <View style={styles.headerRow}>
          <Text style={styles.title}>AI Tactical Advisor</Text>
          <Text style={styles.emoji}>{getStatusEmoji(aiInsights.match_status)}</Text>
        </View>

        {/* Connection Status */}
        <View style={styles.connectionStatus}>
          <View style={[styles.statusDot, { backgroundColor: isConnected ? colors.pitch400 : colors.gold400 }]} />
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

        {/* Recommended Next Bowler - replaces the old synthetic-model "Key Recommendations"
        block, which showed a "Player #149"-style number with no correspondence to any real
        player (that model has no roster input at all). This one is grounded in the bowling
        team's actual roster and this app's own matchup/tendency data. */}
        {bowlerRec?.recommendation && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recommended Next Bowler</Text>
            <View style={styles.recommendationCard}>
              <Text style={styles.recommendationLabel}>vs {bowlerRec.striker.name}</Text>
              <Text style={styles.recommendationValue}>{bowlerRec.recommendation.name}</Text>
            </View>
            <View style={[styles.adviceBox, { marginTop: 12 }]}>
              <Text style={styles.adviceText}>{bowlerRec.recommendation.reason}</Text>
            </View>
          </View>
        )}

        {/* Live Status Footer */}
        <View style={styles.liveFooter}>
          <Text style={styles.liveText}>
            🔴 Live - Updates in real-time
          </Text>
        </View>
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 13,
    color: colors.inkSecondary,
    textAlign: 'center',
  },
  errorCard: {
    backgroundColor: colors.surface,
    borderLeftWidth: 4,
    borderLeftColor: colors.wicket500,
  },
  errorText: {
    color: colors.wicket400,
    fontSize: 14,
  },
  mainCard: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.ink,
  },
  emoji: {
    fontSize: 22,
  },
  connectionStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.surfaceAlt,
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
    color: colors.inkSecondary,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.inkMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.3,
    marginBottom: 10,
  },
  probabilityContainer: {
    marginBottom: 12,
  },
  progressBar: {
    height: 8,
    borderRadius: 4,
    marginBottom: 8,
    backgroundColor: colors.surfaceAlt,
  },
  probabilityText: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'right',
  },
  statusBadge: {
    fontSize: 13,
    color: colors.inkSecondary,
  },
  statusText: {
    fontWeight: '700',
  },
  adviceBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: 8,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: colors.pitch500,
  },
  adviceText: {
    fontSize: 13,
    lineHeight: 20,
    color: colors.inkSecondary,
  },
  recommendationCard: {
    backgroundColor: colors.pitch900,
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: colors.pitch500,
  },
  recommendationLabel: {
    fontSize: 12,
    color: colors.inkMuted,
    marginBottom: 6,
  },
  recommendationValue: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.pitch400,
  },
  liveFooter: {
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  liveText: {
    fontSize: 12,
    color: colors.wicket400,
    fontWeight: '600',
  },
});

export default AITacticalAdvisor;
