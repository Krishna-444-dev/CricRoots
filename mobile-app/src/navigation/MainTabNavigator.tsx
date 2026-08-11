// Main tab navigator for authenticated users. Each tab hosts its own stack navigator (see
// ./stacks/) so feature areas can push detail screens without leaving their tab.
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import HomeStack from './stacks/HomeStack';
import MatchesStack from './stacks/MatchesStack';
import TeamsStack from './stacks/TeamsStack';
import TournamentsStack from './stacks/TournamentsStack';
import ProfileStack from './stacks/ProfileStack';

import { colors } from '../theme';

const Tab = createBottomTabNavigator();

const TAB_ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ['home', 'home-outline'],
  Matches: ['baseball', 'baseball-outline'],
  Teams: ['people', 'people-outline'],
  Tournaments: ['trophy', 'trophy-outline'],
  Profile: ['person', 'person-outline'],
};

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          const [filled, outline] = TAB_ICONS[route.name] || ['ellipse', 'ellipse-outline'];
          return <Ionicons name={focused ? filled : outline} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.pitch400,
        tabBarInactiveTintColor: colors.inkMuted,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
      })}
    >
      <Tab.Screen name="Home" component={HomeStack} />
      <Tab.Screen name="Matches" component={MatchesStack} />
      <Tab.Screen name="Teams" component={TeamsStack} />
      <Tab.Screen name="Tournaments" component={TournamentsStack} />
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
