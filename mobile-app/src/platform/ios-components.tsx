// iOS-specific UI components for the CricSync mobile application
import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { Button, Card, TextInput } from 'react-native-paper';
import { colors } from '../theme';
import { iOSConfig } from './ios';

// iOS-styled button component
export const IOSButton = ({ title, onPress, style, mode = 'contained', disabled = false, loading = false }) => {
  const baseStyle = mode === 'contained' 
    ? styles.containedButton 
    : mode === 'outlined' 
      ? styles.outlinedButton 
      : styles.textButton;
  
  const textStyle = mode === 'contained' 
    ? styles.containedButtonText 
    : mode === 'outlined' 
      ? styles.outlinedButtonText 
      : styles.textButtonText;
  
  const disabledStyle = disabled ? styles.disabledButton : {};
  const disabledTextStyle = disabled ? styles.disabledButtonText : {};
  
  return (
    <TouchableOpacity
      style={[baseStyle, style, disabledStyle]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={mode === 'contained' ? 'white' : colors.primary} />
        </View>
      ) : (
        <Text style={[textStyle, disabledTextStyle]}>{title}</Text>
      )}
    </TouchableOpacity>
  );
};

// iOS-styled card component
export const IOSCard = ({ children, style }) => {
  return (
    <Card style={[styles.card, style]}>
      {children}
    </Card>
  );
};

// iOS-styled text input component
export const IOSTextInput = (props) => {
  return (
    <TextInput
      {...props}
      style={[styles.textInput, props.style]}
      mode="outlined"
      outlineColor={colors.border}
      activeOutlineColor={colors.primary}
      theme={{
        roundness: 10,
        colors: {
          primary: colors.primary,
          background: 'white',
        },
      }}
    />
  );
};

// iOS-styled segmented control component
export const IOSSegmentedControl = ({ values, selectedIndex, onChange, style }) => {
  return (
    <View style={[styles.segmentedControlContainer, style]}>
      {values.map((value, index) => (
        <TouchableOpacity
          key={index}
          style={[
            styles.segmentedControlOption,
            index === 0 && styles.segmentedControlFirstOption,
            index === values.length - 1 && styles.segmentedControlLastOption,
            index === selectedIndex && styles.segmentedControlSelectedOption,
          ]}
          onPress={() => onChange(index)}
        >
          <Text
            style={[
              styles.segmentedControlText,
              index === selectedIndex && styles.segmentedControlSelectedText,
            ]}
          >
            {value}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// iOS-styled action sheet button
export const IOSActionSheetButton = ({ title, onPress, destructive = false, cancel = false, style }) => {
  return (
    <TouchableOpacity
      style={[
        styles.actionSheetButton,
        destructive && styles.actionSheetDestructiveButton,
        cancel && styles.actionSheetCancelButton,
        style,
      ]}
      onPress={onPress}
    >
      <Text
        style={[
          styles.actionSheetButtonText,
          destructive && styles.actionSheetDestructiveText,
          cancel && styles.actionSheetCancelText,
        ]}
      >
        {title}
      </Text>
    </TouchableOpacity>
  );
};

// iOS-styled navigation bar button
export const IOSNavigationBarButton = ({ title, onPress, style }) => {
  return (
    <TouchableOpacity style={[styles.navigationBarButton, style]} onPress={onPress}>
      <Text style={styles.navigationBarButtonText}>{title}</Text>
    </TouchableOpacity>
  );
};

// iOS-styled styles
const styles = StyleSheet.create({
  // Button styles
  containedButton: {
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1.5,
  },
  outlinedButton: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textButton: {
    backgroundColor: 'transparent',
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  containedButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  outlinedButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  textButtonText: {
    color: colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
  disabledButton: {
    opacity: 0.5,
  },
  disabledButtonText: {
    opacity: 0.8,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  
  // Card styles
  card: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 0, // No elevation on iOS
  },
  
  // Text input styles
  textInput: {
    backgroundColor: 'white',
    fontSize: 16,
    height: 50,
  },
  
  // Segmented control styles
  segmentedControlContainer: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  segmentedControlOption: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentedControlFirstOption: {
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
  },
  segmentedControlLastOption: {
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
  },
  segmentedControlSelectedOption: {
    backgroundColor: 'white',
  },
  segmentedControlText: {
    fontSize: 14,
    color: '#666',
  },
  segmentedControlSelectedText: {
    color: colors.primary,
    fontWeight: '600',
  },
  
  // Action sheet button styles
  actionSheetButton: {
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: 'white',
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  actionSheetDestructiveButton: {
    backgroundColor: 'white',
  },
  actionSheetCancelButton: {
    backgroundColor: '#f9f9f9',
    marginTop: 8,
  },
  actionSheetButtonText: {
    fontSize: 18,
    color: colors.primary,
  },
  actionSheetDestructiveText: {
    color: 'red',
  },
  actionSheetCancelText: {
    fontWeight: '600',
  },
  
  // Navigation bar button styles
  navigationBarButton: {
    paddingHorizontal: 12,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navigationBarButtonText: {
    fontSize: 17,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default {
  Button: IOSButton,
  Card: IOSCard,
  TextInput: IOSTextInput,
  SegmentedControl: IOSSegmentedControl,
  ActionSheetButton: IOSActionSheetButton,
  NavigationBarButton: IOSNavigationBarButton,
};
