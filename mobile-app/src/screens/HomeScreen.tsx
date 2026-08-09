// iOS-styled HomeScreen for the CricSync mobile application
import React from 'react';
import { View, ScrollView, StyleSheet, Image, TouchableOpacity } from 'react-native';
import { Text, Card, Button, Divider } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { PlatformFadeIn, PlatformSlideIn, PlatformCard, PlatformButton } from '../IntegratedApp';

const HomeScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  
  // Mock data for upcoming matches
  const upcomingMatches = [
    {
      id: '1',
      team1: 'Royal Challengers',
      team2: 'Super Kings',
      date: 'Today, 7:30 PM',
      venue: 'M. Chinnaswamy Stadium',
      tournament: 'Premier League'
    },
    {
      id: '2',
      team1: 'Mumbai Indians',
      team2: 'Delhi Capitals',
      date: 'Tomorrow, 3:30 PM',
      venue: 'Wankhede Stadium',
      tournament: 'Premier League'
    },
    {
      id: '3',
      team1: 'Sunrisers',
      team2: 'Knight Riders',
      date: 'Apr 2, 7:30 PM',
      venue: 'Rajiv Gandhi Stadium',
      tournament: 'Premier League'
    }
  ];
  
  // Mock data for recent tournaments
  const recentTournaments = [
    {
      id: '1',
      name: 'Premier League 2025',
      teams: 8,
      matches: 56,
      status: 'In Progress'
    },
    {
      id: '2',
      name: 'County Championship',
      teams: 12,
      matches: 132,
      status: 'Upcoming'
    },
    {
      id: '3',
      name: 'T20 World Cup',
      teams: 16,
      matches: 45,
      status: 'Completed'
    }
  ];
  
  // Mock data for featured products
  const featuredProducts = [
    {
      id: '1',
      name: 'Pro Cricket Bat',
      price: '$149.99',
      image: 'https://example.com/bat.jpg'
    },
    {
      id: '2',
      name: 'Premium Gloves',
      price: '$49.99',
      image: 'https://example.com/gloves.jpg'
    },
    {
      id: '3',
      name: 'Match Ball Set',
      price: '$29.99',
      image: 'https://example.com/balls.jpg'
    }
  ];
  
  return (
    <ScrollView 
      style={[styles.container, { paddingTop: insets.top > 0 ? 0 : 16 }]}
      contentInsetAdjustmentBehavior="automatic"
    >
      {/* Welcome Section */}
      <PlatformFadeIn duration={500}>
        <View style={styles.welcomeSection}>
          <Text style={styles.welcomeTitle}>Welcome to CricSync</Text>
          <Text style={styles.welcomeSubtitle}>Your complete cricket companion</Text>
        </View>
      </PlatformFadeIn>
      
      {/* Quick Actions */}
      <PlatformSlideIn direction="right" duration={600} delay={200}>
        <View style={styles.quickActionsContainer}>
          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => navigation.navigate('Scoring')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.primary }]}>
              <Text style={styles.quickActionIconText}>S</Text>
            </View>
            <Text style={styles.quickActionText}>Score Match</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => navigation.navigate('Teams')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: colors.secondary }]}>
              <Text style={styles.quickActionIconText}>T</Text>
            </View>
            <Text style={styles.quickActionText}>Teams</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => navigation.navigate('Shop')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#4caf50' }]}>
              <Text style={styles.quickActionIconText}>S</Text>
            </View>
            <Text style={styles.quickActionText}>Shop</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickActionItem}
            onPress={() => {}}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: '#f44336' }]}>
              <Text style={styles.quickActionIconText}>A</Text>
            </View>
            <Text style={styles.quickActionText}>AI Assist</Text>
          </TouchableOpacity>
        </View>
      </PlatformSlideIn>
      
      {/* Upcoming Matches */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Upcoming Matches</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollView}>
          {upcomingMatches.map((match, index) => (
            <PlatformSlideIn key={match.id} direction="right" duration={500} delay={300 + index * 100}>
              <PlatformCard style={styles.matchCard}>
                <View style={styles.matchCardContent}>
                  <View style={styles.teamsContainer}>
                    <Text style={styles.teamName}>{match.team1}</Text>
                    <Text style={styles.vsText}>vs</Text>
                    <Text style={styles.teamName}>{match.team2}</Text>
                  </View>
                  <Divider style={styles.divider} />
                  <Text style={styles.matchDetail}>{match.date}</Text>
                  <Text style={styles.matchDetail}>{match.venue}</Text>
                  <Text style={styles.tournamentName}>{match.tournament}</Text>
                  <PlatformButton 
                    title="View Details"
                    mode="outlined"
                    onPress={() => {}}
                    style={styles.matchButton}
                  />
                </View>
              </PlatformCard>
            </PlatformSlideIn>
          ))}
        </ScrollView>
      </View>
      
      {/* Recent Tournaments */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Tournaments</Text>
          <TouchableOpacity>
            <Text style={styles.seeAllText}>See All</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollView}>
          {recentTournaments.map((tournament, index) => (
            <PlatformSlideIn key={tournament.id} direction="right" duration={500} delay={400 + index * 100}>
              <PlatformCard style={styles.tournamentCard}>
                <View style={styles.tournamentCardContent}>
                  <Text style={styles.tournamentCardTitle}>{tournament.name}</Text>
                  <Divider style={styles.divider} />
                  <View style={styles.tournamentStats}>
                    <View style={styles.tournamentStat}>
                      <Text style={styles.tournamentStatValue}>{tournament.teams}</Text>
                      <Text style={styles.tournamentStatLabel}>Teams</Text>
                    </View>
                    <View style={styles.tournamentStat}>
                      <Text style={styles.tournamentStatValue}>{tournament.matches}</Text>
                      <Text style={styles.tournamentStatLabel}>Matches</Text>
                    </View>
                    <View style={styles.tournamentStat}>
                      <Text style={[
                        styles.tournamentStatValue, 
                        { 
                          color: tournament.status === 'In Progress' ? colors.primary : 
                                 tournament.status === 'Upcoming' ? colors.secondary : 
                                 '#4caf50'
                        }
                      ]}>
                        {tournament.status}
                      </Text>
                      <Text style={styles.tournamentStatLabel}>Status</Text>
                    </View>
                  </View>
                  <PlatformButton 
                    title="View Tournament"
                    mode="outlined"
                    onPress={() => {}}
                    style={styles.tournamentButton}
                  />
                </View>
              </PlatformCard>
            </PlatformSlideIn>
          ))}
        </ScrollView>
      </View>
      
      {/* Featured Products */}
      <View style={styles.sectionContainer}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Featured Products</Text>
          <TouchableOpacity onPress={() => navigation.navigate('Shop')}>
            <Text style={styles.seeAllText}>Shop All</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScrollView}>
          {featuredProducts.map((product, index) => (
            <PlatformSlideIn key={product.id} direction="right" duration={500} delay={500 + index * 100}>
              <PlatformCard style={styles.productCard}>
                <View style={styles.productCardContent}>
                  <View style={styles.productImageContainer}>
                    {/* Placeholder for product image */}
                    <View style={styles.productImagePlaceholder}>
                      <Text style={styles.productImagePlaceholderText}>Image</Text>
                    </View>
                  </View>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productPrice}>{product.price}</Text>
                  <PlatformButton 
                    title="Add to Cart"
                    mode="contained"
                    onPress={() => {}}
                    style={styles.productButton}
                  />
                </View>
              </PlatformCard>
            </PlatformSlideIn>
          ))}
        </ScrollView>
      </View>
      
      {/* Bottom Spacer */}
      <View style={{ height: 20 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  welcomeSection: {
    paddingHorizontal: 16,
    paddingVertical: 24,
    backgroundColor: colors.primary,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  welcomeTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: 'rgba(255, 255, 255, 0.8)',
  },
  quickActionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  quickActionItem: {
    alignItems: 'center',
    width: '22%',
  },
  quickActionIcon: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionIconText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  quickActionText: {
    fontSize: 12,
    textAlign: 'center',
    color: colors.text,
  },
  sectionContainer: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
  },
  seeAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  horizontalScrollView: {
    paddingLeft: 16,
  },
  matchCard: {
    width: 280,
    marginRight: 16,
    borderRadius: 12,
  },
  matchCardContent: {
    padding: 16,
  },
  teamsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    width: '40%',
  },
  vsText: {
    fontSize: 14,
    color: colors.textSecondary,
    width: '20%',
    textAlign: 'center',
  },
  divider: {
    marginVertical: 12,
  },
  matchDetail: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  tournamentName: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 12,
  },
  matchButton: {
    marginTop: 8,
  },
  tournamentCard: {
    width: 250,
    marginRight: 16,
    borderRadius: 12,
  },
  tournamentCardContent: {
    padding: 16,
  },
  tournamentCardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  tournamentStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  tournamentStat: {
    alignItems: 'center',
  },
  tournamentStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  tournamentStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  tournamentButton: {
    marginTop: 8,
  },
  productCard: {
    width: 180,
    marginRight: 16,
    borderRadius: 12,
  },
  productCardContent: {
    padding: 16,
  },
  productImageContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  productImagePlaceholder: {
    width: 120,
    height: 120,
    backgroundColor: '#e0e0e0',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImagePlaceholderText: {
    color: '#9e9e9e',
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: 12,
  },
  productButton: {
    marginTop: 8,
  },
});

export default HomeScreen;
