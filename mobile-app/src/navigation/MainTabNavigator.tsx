// Main tab navigator for authenticated users. Each tab hosts its own stack navigator (see
// ./stacks/) so feature areas can push detail screens without leaving their tab.
import React, { useEffect, useState } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import HomeStack from './stacks/HomeStack';
import MatchesStack from './stacks/MatchesStack';
import TeamsStack from './stacks/TeamsStack';
import TournamentsStack from './stacks/TournamentsStack';
import ProfileStack from './stacks/ProfileStack';

import { colors } from '../theme';
import { api } from '../shared/api/apiClient';

// Polling interval for the Profile tab's unread-DM badge. This navigator stays mounted for the
// whole authenticated session (see AppNavigator), so a simple interval - rather than a focus
// listener - is what keeps the badge from going stale while the user sits on another tab. Good
// enough for a v1 without a global socket connection (see MessagesScreen/ProfileScreen, which
// also refetch on focus for the in-screen badges).
const UNREAD_POLL_MS = 20000;

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
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const poll = () => {
      api.messages.getUnreadCount()
        .then(({ count }) => { if (!cancelled) setUnreadCount(count); })
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, UNREAD_POLL_MS);
    return () => { cancelled = true; clearInterval(interval); };
  }, []);

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
      <Tab.Screen
        name="Profile"
        component={ProfileStack}
        options={{
          tabBarBadge: unreadCount > 0 ? (unreadCount > 9 ? '9+' : unreadCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: colors.pitch500, color: colors.background, fontSize: 10 },
        }}
      />
    </Tab.Navigator>
  );
};

export default MainTabNavigator;
