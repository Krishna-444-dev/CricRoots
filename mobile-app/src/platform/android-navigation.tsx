// Android-specific navigation adaptations for the CricSync mobile application
import React from 'react';
import { Platform, View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme';

// Android-specific header configuration
export const androidHeaderConfig = {
  headerStyle: {
    backgroundColor: colors.primary,
    elevation: 4,
    shadowOpacity: 0, // Remove shadow for Android as elevation handles it
  },
  headerTintColor: 'white',
  headerTitleStyle: {
    fontWeight: '500',
    fontSize: 20,
    fontFamily: Platform.OS === 'android' ? 'Roboto' : undefined,
    marginLeft: Platform.OS === 'android' ? 8 : 0, // Material Design alignment
  },
  headerTitleAlign: 'left', // Material Design default
};

// Android-specific tab bar configuration
export const androidTabConfig = {
  tabBarStyle: {
    backgroundColor: 'white',
    elevation: 8,
    height: 56,
    paddingBottom: 0,
  },
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: 'rgba(0, 0, 0, 0.6)',
  tabBarLabelStyle: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  tabBarIconStyle: {
    marginTop: 8,
  },
  tabBarRippleColor: 'rgba(0, 0, 0, 0.1)',
};

// Android-specific transition configuration
export const androidTransitionConfig = {
  animation: 'fade_from_bottom', // Standard Android transition
  gestureEnabled: true,
  gestureDirection: 'vertical',
};

// Android-specific back button handling
export const AndroidBackButton = ({ onPress, color = 'white' }) => {
  // On Android, we typically use the hardware back button or a simple arrow
  return null; // Hardware back button is handled by React Navigation by default
};

const styles = StyleSheet.create({
  // Navigation-related styles
});

export default {
  headerConfig: androidHeaderConfig,
  tabConfig: androidTabConfig,
  transitionConfig: androidTransitionConfig,
  BackButton: AndroidBackButton,
};
