import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Card, Button, TextInput, Chip, SegmentedButtons } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const ScoringScreen = () => {
  const [matchType, setMatchType] = useState('t20');
  const [inningsNumber, setInningsNumber] = useState(1);
  const [currentScore, setCurrentScore] = useState({
    runs: 0,
    wickets: 0,
    overs: 0,
    balls: 0
  });
  const [battingTeam, setBattingTeam] = useState('Team Alpha');
  const [bowlingTeam, setBowlingTeam] = useState('Team Beta');
  const [striker, setStriker] = useState({
    name: 'John Smith',
    runs: 24,
    balls: 18,
    fours: 2,
    sixes: 1
  });
  const [nonStriker, setNonStriker] = useState({
    name: 'David Williams',
    runs: 16,
    balls: 12,
    fours: 1,
    sixes: 0
  });
  const [bowler, setBowler] = useState({
    name: 'Michael Johnson',
    overs: 2,
    maidens: 0,
    runs: 18,
    wickets: 1
  });
  const [lastSixBalls, setLastSixBalls] = useState(['1', '0', 'W', '4', '2', '0']);

  const handleRunsButton = (runs) => {
    // In a real app, this would update the state and send to backend
    console.log(`${runs} runs scored`);
  };

  const handleWicketButton = () => {
    // In a real app, this would open a wicket type selection modal
    console.log('Wicket taken');
  };

  const handleExtraButton = () => {
    // In a real app, this would open an extras type selection modal
    console.log('Extra runs');
  };

  const handleUndoButton = () => {
    // In a real app, this would undo the last action
    console.log('Undo last action');
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Live Scoring</Text>
        </View>

        <Card style={styles.matchInfoCard}>
          <Card.Content>
            <View style={styles.teamsContainer}>
              <Text style={styles.teamName}>{battingTeam}</Text>
              <Text style={styles.vsText}>vs</Text>
              <Text style={styles.teamName}>{bowlingTeam}</Text>
            </View>
            
            <View style={styles.scoreContainer}>
              <Text style={styles.scoreText}>
                {currentScore.runs}/{currentScore.wickets}
              </Text>
              <Text style={styles.oversText}>
                ({currentScore.overs}.{currentScore.balls})
              </Text>
            </View>

            <SegmentedButtons
              value={matchType}
              onValueChange={setMatchType}
              buttons={[
                { value: 't20', label: 'T20' },
                { value: 'odi', label: 'ODI' },
                { value: 'test', label: 'Test' }
              ]}
              style={styles.segmentedButtons}
            />
          </Card.Content>
        </Card>

        <Card style={styles.playersCard}>
          <Card.Content>
            <View style={styles.batsmenContainer}>
              <Text style={styles.sectionTitle}>Batsmen</Text>
              <View style={styles.batsmanRow}>
                <Text style={[styles.batsmanName, styles.onStrike]}>{striker.name} *</Text>
                <Text style={styles.batsmanStat}>{striker.runs} ({striker.balls})</Text>
                <Text style={styles.batsmanStat}>{striker.fours}</Text>
                <Text style={styles.batsmanStat}>{striker.sixes}</Text>
              </View>
              <View style={styles.batsmanRow}>
                <Text style={styles.batsmanName}>{nonStriker.name}</Text>
                <Text style={styles.batsmanStat}>{nonStriker.runs} ({nonStriker.balls})</Text>
                <Text style={styles.batsmanStat}>{nonStriker.fours}</Text>
                <Text style={styles.batsmanStat}>{nonStriker.sixes}</Text>
              </View>
              <View style={styles.batsmanHeaderRow}>
                <Text style={styles.batsmanHeader}>Batsman</Text>
                <Text style={styles.batsmanHeader}>R (B)</Text>
                <Text style={styles.batsmanHeader}>4s</Text>
                <Text style={styles.batsmanHeader}>6s</Text>
              </View>
            </View>

            <View style={styles.bowlerContainer}>
              <Text style={styles.sectionTitle}>Bowler</Text>
              <View style={styles.bowlerRow}>
                <Text style={styles.bowlerName}>{bowler.name}</Text>
                <Text style={styles.bowlerStat}>{bowler.overs}.{currentScore.balls}</Text>
                <Text style={styles.bowlerStat}>{bowler.maidens}</Text>
                <Text style={styles.bowlerStat}>{bowler.runs}</Text>
                <Text style={styles.bowlerStat}>{bowler.wickets}</Text>
              </View>
              <View style={styles.bowlerHeaderRow}>
                <Text style={styles.bowlerHeader}>Bowler</Text>
                <Text style={styles.bowlerHeader}>O</Text>
                <Text style={styles.bowlerHeader}>M</Text>
                <Text style={styles.bowlerHeader}>R</Text>
                <Text style={styles.bowlerHeader}>W</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.thisOverCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>This Over</Text>
            <View style={styles.ballsContainer}>
              {lastSixBalls.map((ball, index) => (
                <Chip key={index} style={styles.ballChip} textStyle={styles.ballText}>
                  {ball}
                </Chip>
              ))}
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.scoringActionsCard}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Scoring</Text>
            <View style={styles.runsButtonsContainer}>
              {[0, 1, 2, 3, 4, 6].map((runs) => (
                <TouchableOpacity
                  key={runs}
                  style={styles.runsButton}
                  onPress={() => handleRunsButton(runs)}
                >
                  <Text style={styles.runsButtonText}>{runs}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={styles.actionButtonsContainer}>
              <Button 
                mode="contained" 
                style={[styles.actionButton, styles.wicketButton]}
                onPress={handleWicketButton}
              >
                WICKET
              </Button>
              <Button 
                mode="contained" 
                style={[styles.actionButton, styles.extraButton]}
                onPress={handleExtraButton}
              >
                EXTRAS
              </Button>
              <Button 
                mode="contained" 
                style={[styles.actionButton, styles.undoButton]}
                onPress={handleUndoButton}
              >
                UNDO
              </Button>
            </View>
          </Card.Content>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    padding: 16,
    backgroundColor: '#1e88e5',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  matchInfoCard: {
    margin: 16,
    marginBottom: 8,
  },
  teamsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  teamName: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  vsText: {
    fontSize: 14,
    marginHorizontal: 8,
    color: '#666',
  },
  scoreContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'baseline',
    marginBottom: 16,
  },
  scoreText: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  oversText: {
    fontSize: 16,
    marginLeft: 8,
    color: '#666',
  },
  segmentedButtons: {
    marginTop: 8,
  },
  playersCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  batsmenContainer: {
    marginBottom: 16,
  },
  batsmanHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 4,
    marginBottom: 8,
  },
  batsmanHeader: {
    fontSize: 12,
    color: '#666',
    flex: 1,
    textAlign: 'center',
  },
  batsmanHeader: {
    fontSize: 12,
    color: '#666',
  },
  batsmanRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  batsmanName: {
    flex: 3,
    fontSize: 14,
  },
  onStrike: {
    fontWeight: 'bold',
  },
  batsmanStat: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  bowlerContainer: {
    marginBottom: 8,
  },
  bowlerHeaderRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    paddingBottom: 4,
    marginBottom: 8,
  },
  bowlerHeader: {
    fontSize: 12,
    color: '#666',
    flex: 1,
    textAlign: 'center',
  },
  bowlerRow: {
    flexDirection: 'row',
    marginBottom: 8,
    alignItems: 'center',
  },
  bowlerName: {
    flex: 3,
    fontSize: 14,
  },
  bowlerStat: {
    flex: 1,
    fontSize: 14,
    textAlign: 'center',
  },
  thisOverCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  ballsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  ballChip: {
    margin: 4,
    backgroundColor: '#e0e0e0',
  },
  ballText: {
    fontSize: 14,
  },
  scoringActionsCard: {
    margin: 16,
    marginTop: 8,
    marginBottom: 24,
  },
  runsButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  runsButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#1e88e5',
    justifyContent: 'center',
    alignItems: 'center',
  },
  runsButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  wicketButton: {
    backgroundColor: '#f44336',
  },
  extraButton: {
    backgroundColor: '#ff9800',
  },
  undoButton: {
    backgroundColor: '#757575',
  },
});

export default ScoringScreen;
