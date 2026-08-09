import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { Card, Avatar, Button } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';

const ProfileScreen = () => {
  // Mock user data
  const user = {
    id: '1',
    name: 'John Smith',
    email: 'john.smith@example.com',
    phone: '+1 (555) 123-4567',
    role: 'Player & Captain',
    teams: ['Royal Challengers', 'City Club'],
    profileImage: null,
    stats: {
      matches: 42,
      runs: 1250,
      wickets: 15,
      highestScore: 87,
      bestBowling: '3/24'
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <View style={styles.profileImageContainer}>
            {user.profileImage ? (
              <Avatar.Image size={100} source={{ uri: user.profileImage }} />
            ) : (
              <Avatar.Text size={100} label={user.name.charAt(0)} style={styles.avatar} />
            )}
          </View>
          <Text style={styles.userName}>{user.name}</Text>
          <Text style={styles.userRole}>{user.role}</Text>
          <View style={styles.teamsContainer}>
            {user.teams.map((team, index) => (
              <View key={index} style={styles.teamBadge}>
                <Text style={styles.teamBadgeText}>{team}</Text>
              </View>
            ))}
          </View>
        </View>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Email:</Text>
              <Text style={styles.infoValue}>{user.email}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Phone:</Text>
              <Text style={styles.infoValue}>{user.phone}</Text>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Player Statistics</Text>
            <View style={styles.statsContainer}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user.stats.matches}</Text>
                <Text style={styles.statLabel}>Matches</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user.stats.runs}</Text>
                <Text style={styles.statLabel}>Runs</Text>
              </View>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user.stats.wickets}</Text>
                <Text style={styles.statLabel}>Wickets</Text>
              </View>
            </View>
            <View style={styles.statsDetails}>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Highest Score:</Text>
                <Text style={styles.infoValue}>{user.stats.highestScore}</Text>
              </View>
              <View style={styles.infoRow}>
                <Text style={styles.infoLabel}>Best Bowling:</Text>
                <Text style={styles.infoValue}>{user.stats.bestBowling}</Text>
              </View>
            </View>
          </Card.Content>
        </Card>

        <Card style={styles.card}>
          <Card.Content>
            <Text style={styles.sectionTitle}>Account Settings</Text>
            <Button 
              mode="outlined" 
              icon="account-edit" 
              style={styles.settingsButton}
            >
              Edit Profile
            </Button>
            <Button 
              mode="outlined" 
              icon="lock-reset" 
              style={styles.settingsButton}
            >
              Change Password
            </Button>
            <Button 
              mode="outlined" 
              icon="bell-outline" 
              style={styles.settingsButton}
            >
              Notification Settings
            </Button>
            <Button 
              mode="outlined" 
              icon="credit-card-outline" 
              style={styles.settingsButton}
            >
              Payment Methods
            </Button>
          </Card.Content>
        </Card>

        <Button 
          mode="contained" 
          icon="logout" 
          style={styles.logoutButton}
          contentStyle={styles.logoutButtonContent}
        >
          Log Out
        </Button>
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
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#1e88e5',
  },
  profileImageContainer: {
    marginBottom: 16,
  },
  avatar: {
    backgroundColor: '#0d47a1',
  },
  userName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  userRole: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
    marginBottom: 12,
  },
  teamsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  teamBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    margin: 4,
  },
  teamBadgeText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  card: {
    margin: 16,
    marginTop: 8,
    marginBottom: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  infoLabel: {
    width: 100,
    fontSize: 14,
    color: '#666',
  },
  infoValue: {
    flex: 1,
    fontSize: 14,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1e88e5',
  },
  statLabel: {
    fontSize: 12,
    color: '#666',
  },
  statsDetails: {
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    paddingTop: 16,
  },
  settingsButton: {
    marginBottom: 8,
    borderColor: '#1e88e5',
  },
  logoutButton: {
    margin: 16,
    marginTop: 8,
    marginBottom: 24,
    backgroundColor: '#f44336',
  },
  logoutButtonContent: {
    height: 48,
  },
});

export default ProfileScreen;
