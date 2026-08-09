// Android-specific UI components for the CricSync mobile application
import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text, ActivityIndicator } from 'react-native';
import { Button, Card, TextInput, TouchableRipple } from 'react-native-paper';
import { colors } from '../theme';
import { androidConfig } from './android';

// Android-styled button component (Material Design)
export const AndroidButton = ({ title, onPress, style, mode = 'contained', disabled = false, loading = false }) => {
  const isContained = mode === 'contained';
  const isOutlined = mode === 'outlined';
  
  return (
    <TouchableRipple
      onPress={onPress}
      disabled={disabled || loading}
      rippleColor="rgba(0, 0, 0, .1)"
      style={[
        styles.buttonBase,
        isContained && styles.containedButton,
        isOutlined && styles.outlinedButton,
        disabled && styles.disabledButton,
        style
      ]}
    >
      <View style={styles.buttonContent}>
        {loading ? (
          <ActivityIndicator size="small" color={isContained ? 'white' : colors.primary} />
        ) : (
          <Text style={[
            styles.buttonText,
            isContained && styles.containedButtonText,
            isOutlined && styles.outlinedButtonText,
            !isContained && !isOutlined && styles.textButtonText,
            disabled && styles.disabledButtonText
          ]}>
            {title.toUpperCase()}
          </Text>
        )}
      </View>
    </TouchableRipple>
  );
};

// Android-styled card component (Material Design)
export const AndroidCard = ({ children, style }) => {
  return (
    <Card style={[styles.card, style]} elevation={2}>
      {children}
    </Card>
  );
};

// Android-styled text input component (Material Design)
export const AndroidTextInput = (props) => {
  return (
    <TextInput
      {...props}
      style={[styles.textInput, props.style]}
      mode="flat" // Material Design default for Android
      underlineColor={colors.border}
      activeUnderlineColor={colors.primary}
      theme={{
        colors: {
          primary: colors.primary,
          background: '#f5f5f5',
        },
      }}
    />
  );
};

// Android-styled tabs component (Material Design)
export const AndroidTabs = ({ values, selectedIndex, onChange, style }) => {
  return (
    <View style={[styles.tabsContainer, style]}>
      {values.map((value, index) => (
        <TouchableRipple
          key={index}
          style={[
            styles.tabOption,
            index === selectedIndex && styles.selectedTabOption,
          ]}
          onPress={() => onChange(index)}
        >
          <View style={styles.tabContent}>
            <Text
              style={[
                styles.tabText,
                index === selectedIndex && styles.selectedTabText,
              ]}
            >
              {value.toUpperCase()}
            </Text>
            {index === selectedIndex && <View style={styles.tabIndicator} />}
          </View>
        </TouchableRipple>
      ))}
    </View>
  );
};

// Android-styled styles
const styles = StyleSheet.create({
  // Button styles
  buttonBase: {
    borderRadius: 4,
    minWidth: 64,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  buttonContent: {
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  containedButton: {
    backgroundColor: colors.primary,
    elevation: 2,
  },
  outlinedButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '500',
    letterSpacing: 1.25,
  },
  containedButtonText: {
    color: 'white',
  },
  outlinedButtonText: {
    color: colors.primary,
  },
  textButtonText: {
    color: colors.primary,
  },
  disabledButton: {
    backgroundColor: 'rgba(0, 0, 0, 0.12)',
    elevation: 0,
  },
  disabledButtonText: {
    color: 'rgba(0, 0, 0, 0.38)',
  },
  
  // Card styles
  card: {
    borderRadius: 4,
    backgroundColor: 'white',
  },
  
  // Text input styles
  textInput: {
    backgroundColor: '#f5f5f5',
    fontSize: 16,
    height: 56,
  },
  
  // Tabs styles (Android top navigation style)
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.primary,
    elevation: 4,
  },
  tabOption: {
    flex: 1,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedTabOption: {
    // No specific background change for selected tab in Material
  },
  tabContent: {
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
    color: 'rgba(255, 255, 255, 0.7)',
  },
  selectedTabText: {
    color: 'white',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: 'white',
  },
});

export default {
  Button: AndroidButton,
  Card: AndroidCard,
  TextInput: AndroidTextInput,
  Tabs: AndroidTabs,
};
