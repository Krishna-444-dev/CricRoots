import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRoute, useNavigation } from '@react-navigation/native';
import { Card, Button, FAB } from 'react-native-paper';
import AITacticalAdvisor from '../components/AITacticalAdvisor';
import { colors } from '../theme';

interface Match {
  _id: string;
  title: string;
  team1: { _id: string; name: string };
  team2: { _id: string; name: string };
  status: string;
  venue: string;
  innings: Array<{
    team: string;
    runs: number;
    wickets: number;
    overs: number;
  }>;
}

export const LiveMatchScreen: React.FC = () => {
  const route = useRoute();
  const navigation = useNavigation();
  const { matchId } = route.params as { matchId: string };

  const [match, setMatch] = useState<Match | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scorecard' | 'ai-insights'>('scorecard');

  useEffect(() => {
    fetchMatch();
    // Refresh match data every 10 seconds during live match
    const interval = setInterval(fetchMatch, 10000);
    return () => clearInterval(interval);
  }, [matchId]);

  const fetchMatch = async () => {
    try {
      const response = await fetch(`/api/matches/${matchId}`);
      const data = await response.json();
      
      if (data.success) {
        setMatch(data.match);
        setError(null);
      } else {
        setError('Failed to fetch match');
      }
    } catch (err) {
      setError('Error fetching match data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRecordBall = () => {
    // Navigate to ball recording screen
    navigation.navigate('RecordBall', { matchId });
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  if (error || !match) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>{error || 'Match not found'}</Text>
        <Button
          mode="contained"
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          Go Back
        </Button>
      </View>
    );
  }

  const currentInnings = match.innings[match.status === 'Live' ? 1 : 0];
  const targetScore = match.innings[0]?.runs || 0;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.matchTitle}>{match.title}</Text>
        <Text style={styles.venue}>{match.venue}</Text>
      </View>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'scorecard' && styles.activeTab]}
          onPress={() => setActiveTab('scorecard')}
        >
          <Text style={[styles.tabText, activeTab === 'scorecard' && styles.activeTabText]}>
            Scorecard
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ai-insights' && styles.activeTab]}
          onPress={() => setActiveTab('ai-insights')}
        >
          <Text style={[styles.tabText, activeTab === 'ai-insights' && styles.activeTabText]}>
            AI Insights
          </Text>
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content}>
        {activeTab === 'scorecard' ? (
          <>
            {/* Team Scores */}
            <Card style={styles.scoreCard}>
              <Card.Content>
                <View style={styles.teamsContainer}>
                  <View style={styles.teamScore}>
                    <Text style={styles.teamName}>{match.team1.name}</Text>
                    <Text style={styles.score}>
                      {match.innings[0]?.runs || 0}/{match.innings[0]?.wickets || 0}
                    </Text>
                    <Text style={styles.overs}>
                      ({(match.innings[0]?.overs || 0).toFixed(1)} overs)
                    </Text>
                  </View>

                  <View style={styles.vsContainer}>
                    <Text style={styles.vs}>VS</Text>
                  </View>

                  <View style={styles.teamScore}>
                    <Text style={styles.teamName}>{match.team2.name}</Text>
                    <Text style={styles.score}>
                      {match.innings[1]?.runs || 0}/{match.innings[1]?.wickets || 0}
                    </Text>
                    <Text style={styles.overs}>
                      ({(match.innings[1]?.overs || 0).toFixed(1)} overs)
                    </Text>
                  </View>
                </View>

                {/* Current Status */}
                <View style={styles.statusContainer}>
                  <Text style={styles.statusLabel}>Target:</Text>
                  <Text style={styles.statusValue}>{targetScore} runs</Text>
                </View>
              </Card.Content>
            </Card>

            {/* Recent Balls */}
            <Card style={styles.ballsCard}>
              <Card.Content>
                <Text style={styles.ballsTitle}>Recent Balls</Text>
                <View style={styles.ballsContainer}>
                  {currentInnings?.balls?.slice(-6).map((ball, index) => (
                    <View key={index} style={styles.ballItem}>
                      <Text style={styles.ballNumber}>{ball.runs}</Text>
                      {ball.isWicket && <Text style={styles.wicket}>W</Text>}
                    </View>
                  ))}
                </View>
              </Card.Content>
            </Card>
          </>
        ) : (
          <AITacticalAdvisor matchId={matchId} isLive={match.status === 'Live'} />
        )}
      </ScrollView>

      {/* FAB for Recording Ball */}
      {match.status === 'Live' && (
        <FAB
          style={styles.fab}
          icon="plus"
          label="Record Ball"
          onPress={handleRecordBall}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    backgroundColor: colors.primary,
    padding: 16,
    paddingTop: 8,
  },
  matchTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: 'white',
    marginBottom: 4,
  },
  venue: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  activeTab: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#999',
  },
  activeTabText: {
    color: colors.primary,
  },
  content: {
    flex: 1,
    padding: 12,
  },
  scoreCard: {
    marginBottom: 16,
  },
  teamsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  teamScore: {
    flex: 1,
    alignItems: 'center',
  },
  teamName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  score: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
    marginBottom: 2,
  },
  overs: {
    fontSize: 12,
    color: '#666',
  },
  vsContainer: {
    alignItems: 'center',
    marginHorizontal: 8,
  },
  vs: {
    fontSize: 12,
    fontWeight: '700',
    color: '#999',
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  statusLabel: {
    fontSize: 12,
    color: '#666',
    marginRight: 8,
  },
  statusValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.primary,
  },
  ballsCard: {
    marginBottom: 16,
  },
  ballsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  ballsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  ballItem: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  ballNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.primary,
  },
  wicket: {
    position: 'absolute',
    top: 4,
    right: 4,
    fontSize: 12,
    fontWeight: '700',
    color: '#F44336',
    backgroundColor: 'white',
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
    backgroundColor: colors.primary,
  },
  errorText: {
    fontSize: 16,
    color: '#F44336',
    marginBottom: 16,
    textAlign: 'center',
  },
  backButton: {
    marginTop: 16,
  },
});

export default LiveMatchScreen;
