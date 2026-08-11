// Main tab navigator for authenticated users. Each tab hosts its own stack navigator (see
// ./stacks/) so feature areas can push detail screens without leaving their tab.
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import HomeStack from './stacks/HomeStack';
import MatchesStack from './stacks/MatchesStack';
import TeamsStack from './stacks/TeamsStack';
import TournamentsStack from './stacks/TournamentsStack';
import ProfileStack from './stacks/ProfileStack';

import { colors } from '../theme';

const Tab = createBottomTabNavigator();

// Ionicons has no cricket-ball glyph (its closest options are baseball/tennisball, which read
// wrong for a cricket-first app) - MaterialCommunityIcons does have a proper "cricket" icon, so
// the Matches tab uses that family instead. MDI's "cricket" has no separate outline variant, so
// focus state there is conveyed by tabBarActiveTintColor's color change alone.
const IONICONS_TAB_ICONS: Record<string, [keyof typeof Ionicons.glyphMap, keyof typeof Ionicons.glyphMap]> = {
  Home: ['home', 'home-outline'],
  Teams: ['people', 'people-outline'],
  Tournaments: ['trophy', 'trophy-outline'],
  Profile: ['person', 'person-outline'],
};

const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      id={undefined}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          if (route.name === 'Matches') {
            return <MaterialCommunityIcons name="cricket" size={size} color={color} />;
          }
          const [filled, outline] = IONICONS_TAB_ICONS[route.name] || ['ellipse', 'ellipse-outline'];
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
