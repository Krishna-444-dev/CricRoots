// iOS-styled TeamsScreen for the CricSync mobile application
import React, { useState } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Text, Searchbar, Divider, Avatar, FAB } from 'react-native-paper';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { PlatformCard, PlatformButton, PlatformSlideIn, PlatformSegmentedControl } from '../IntegratedApp';

const TeamsScreen = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTab, setSelectedTab] = useState(0);
  
  // Mock data for teams
  const myTeams = [
    {
      id: '1',
      name: 'Royal Challengers',
      role: 'Captain',
      members: 16,
      matches: 24,
      wins: 18,
      logo: null
    },
    {
      id: '2',
      name: 'Super Kings',
      role: 'Player',
      members: 14,
      matches: 22,
      wins: 14,
      logo: null
    },
    {
      id: '3',
      name: 'Mumbai Indians',
      role: 'Manager',
      members: 15,
      matches: 20,
      wins: 12,
      logo: null
    }
  ];
  
  const allTeams = [
    ...myTeams,
    {
      id: '4',
      name: 'Delhi Capitals',
      role: null,
      members: 15,
      matches: 23,
      wins: 15,
      logo: null
    },
    {
      id: '5',
      name: 'Knight Riders',
      role: null,
      members: 14,
      matches: 21,
      wins: 13,
      logo: null
    },
    {
      id: '6',
      name: 'Sunrisers',
      role: null,
      members: 16,
      matches: 22,
      wins: 14,
      logo: null
    }
  ];
  
  const onChangeSearch = query => setSearchQuery(query);
  
  const renderTeamItem = ({ item, index }) => (
    <PlatformSlideIn direction="right" duration={400} delay={200 + index * 100}>
      <PlatformCard style={styles.teamCard}>
        <TouchableOpacity 
          style={styles.teamCardContent}
          onPress={() => navigation.navigate('TeamDetails', { teamId: item.id })}
        >
          <View style={styles.teamHeader}>
            <View style={styles.teamLogoContainer}>
              {item.logo ? (
                <Image source={{ uri: item.logo }} style={styles.teamLogo} />
              ) : (
                <Avatar.Text 
                  size={50} 
                  label={item.name.substring(0, 2)} 
                  backgroundColor={colors.primary}
                  color="white"
                />
              )}
            </View>
            <View style={styles.teamInfo}>
              <Text style={styles.teamName}>{item.name}</Text>
              {item.role && (
                <View style={styles.roleContainer}>
                  <Text style={styles.roleText}>{item.role}</Text>
                </View>
              )}
            </View>
          </View>
          
          <Divider style={styles.divider} />
          
          <View style={styles.teamStats}>
            <View style={styles.teamStat}>
              <Text style={styles.teamStatValue}>{item.members}</Text>
              <Text style={styles.teamStatLabel}>Members</Text>
            </View>
            <View style={styles.teamStat}>
              <Text style={styles.teamStatValue}>{item.matches}</Text>
              <Text style={styles.teamStatLabel}>Matches</Text>
            </View>
            <View style={styles.teamStat}>
              <Text style={styles.teamStatValue}>{item.wins}</Text>
              <Text style={styles.teamStatLabel}>Wins</Text>
            </View>
            <View style={styles.teamStat}>
              <Text style={styles.teamStatValue}>
                {Math.round((item.wins / item.matches) * 100)}%
              </Text>
              <Text style={styles.teamStatLabel}>Win Rate</Text>
            </View>
          </View>
          
          <View style={styles.teamActions}>
            {item.role ? (
              <PlatformButton
                title="Manage Team"
                mode="outlined"
                onPress={() => navigation.navigate('ManageTeam', { teamId: item.id })}
                style={styles.teamButton}
              />
            ) : (
              <PlatformButton
                title="Join Team"
                mode="contained"
                onPress={() => {}}
                style={styles.teamButton}
              />
            )}
          </View>
        </TouchableOpacity>
      </PlatformCard>
    </PlatformSlideIn>
  );
  
  return (
    <View style={[styles.container, { paddingTop: insets.top > 0 ? 0 : 16 }]}>
      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <Searchbar
          placeholder="Search teams"
          onChangeText={onChangeSearch}
          value={searchQuery}
          style={styles.searchBar}
          iconColor={colors.primary}
        />
      </View>
      
      {/* Tabs */}
      <View style={styles.tabsContainer}>
        <PlatformSegmentedControl
          values={['My Teams', 'All Teams']}
          selectedIndex={selectedTab}
          onChange={setSelectedTab}
          style={styles.tabs}
        />
      </View>
      
      {/* Team List */}
      <FlatList
        data={selectedTab === 0 ? myTeams : allTeams}
        renderItem={renderTeamItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Create Team FAB */}
      <FAB
        style={[styles.fab, { bottom: insets.bottom + 16 }]}
        icon="plus"
        color="white"
        onPress={() => navigation.navigate('CreateTeam')}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9f9f9',
  },
  searchContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  searchBar: {
    elevation: 0,
    borderRadius: 10,
    backgroundColor: 'white',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  tabsContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  tabs: {
    marginBottom: 8,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 80,
  },
  teamCard: {
    marginBottom: 16,
    borderRadius: 12,
  },
  teamCardContent: {
    padding: 16,
  },
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  teamLogoContainer: {
    marginRight: 16,
  },
  teamLogo: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  teamInfo: {
    flex: 1,
  },
  teamName: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  roleContainer: {
    backgroundColor: colors.primaryLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  roleText: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '500',
  },
  divider: {
    marginVertical: 12,
  },
  teamStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  teamStat: {
    alignItems: 'center',
  },
  teamStatValue: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  teamStatLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  teamActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  teamButton: {
    minWidth: 120,
  },
  fab: {
    position: 'absolute',
    right: 16,
    backgroundColor: colors.primary,
  },
});

export default TeamsScreen;
