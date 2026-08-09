// iOS-specific navigation adaptations for the CricSync mobile application
import React from 'react';
import { StyleSheet, TouchableOpacity, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';

// iOS-specific back button with gesture support
export const IOSBackButton = ({ onPress, title = 'Back' }) => {
  const navigation = useNavigation();
  
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      navigation.goBack();
    }
  };
  
  return (
    <TouchableOpacity style={styles.backButton} onPress={handlePress}>
      <Ionicons name="chevron-back" size={24} color={colors.primary} />
      <Text style={styles.backButtonText}>{title}</Text>
    </TouchableOpacity>
  );
};

// iOS-specific header with large title support
export const IOSHeader = ({ title, largeTitle = false, rightButton }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.header, { paddingTop: insets.top }]}>
      {largeTitle ? (
        <Text style={styles.largeTitle}>{title}</Text>
      ) : (
        <Text style={styles.title}>{title}</Text>
      )}
      {rightButton && (
        <View style={styles.rightButton}>
          {rightButton}
        </View>
      )}
    </View>
  );
};

// iOS-specific tab bar with animation support
export const IOSTabBar = ({ state, descriptors, navigation }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.tabBar, { paddingBottom: insets.bottom }]}>
      {state.routes.map((route, index) => {
        const { options } = descriptors[route.key];
        const label =
          options.tabBarLabel !== undefined
            ? options.tabBarLabel
            : options.title !== undefined
            ? options.title
            : route.name;

        const isFocused = state.index === index;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });

          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        const onLongPress = () => {
          navigation.emit({
            type: 'tabLongPress',
            target: route.key,
          });
        };

        // Get icon name based on route
        let iconName;
        if (route.name === 'Home') {
          iconName = isFocused ? 'home' : 'home-outline';
        } else if (route.name === 'Teams') {
          iconName = isFocused ? 'people' : 'people-outline';
        } else if (route.name === 'Scoring') {
          iconName = isFocused ? 'stats-chart' : 'stats-chart-outline';
        } else if (route.name === 'Shop') {
          iconName = isFocused ? 'cart' : 'cart-outline';
        } else if (route.name === 'Profile') {
          iconName = isFocused ? 'person' : 'person-outline';
        }

        return (
          <TouchableOpacity
            key={index}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            accessibilityLabel={options.tabBarAccessibilityLabel}
            testID={options.tabBarTestID}
            onPress={onPress}
            onLongPress={onLongPress}
            style={styles.tabBarButton}
          >
            <Ionicons name={iconName} size={24} color={isFocused ? colors.primary : colors.textSecondary} />
            <Text style={[
              styles.tabBarLabel,
              { color: isFocused ? colors.primary : colors.textSecondary }
            ]}>
              {label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

// iOS-specific modal presentation
export const IOSModalHeader = ({ title, onClose }) => {
  const insets = useSafeAreaInsets();
  
  return (
    <View style={[styles.modalHeader, { paddingTop: insets.top }]}>
      <Text style={styles.modalTitle}>{title}</Text>
      <TouchableOpacity style={styles.modalCloseButton} onPress={onClose}>
        <Text style={styles.modalCloseText}>Done</Text>
      </TouchableOpacity>
    </View>
  );
};

// iOS-specific swipe back gesture handler
export const createIOSSwipeBackHandler = (navigation) => {
  return {
    enabled: true,
    onGestureStart: () => {
      // Handle gesture start
    },
    onGestureEnd: (event) => {
      if (event.translationX > 100) {
        navigation.goBack();
      }
    },
  };
};

// iOS-specific styles
const styles = StyleSheet.create({
  // Back button styles
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
  },
  backButtonText: {
    fontSize: 17,
    color: colors.primary,
    marginLeft: 2,
  },
  
  // Header styles
  header: {
    backgroundColor: 'white',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  title: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  largeTitle: {
    fontSize: 34,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 8,
  },
  rightButton: {
    position: 'absolute',
    right: 16,
    bottom: 10,
  },
  
  // Tab bar styles
  tabBar: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderTopWidth: 0.5,
    borderTopColor: '#e0e0e0',
  },
  tabBarButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  tabBarLabel: {
    fontSize: 10,
    marginTop: 2,
  },
  
  // Modal styles
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f9f9f9',
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '600',
    color: colors.text,
  },
  modalCloseButton: {
    position: 'absolute',
    right: 16,
    bottom: 10,
  },
  modalCloseText: {
    fontSize: 17,
    color: colors.primary,
    fontWeight: '600',
  },
});

export default {
  BackButton: IOSBackButton,
  Header: IOSHeader,
  TabBar: IOSTabBar,
  ModalHeader: IOSModalHeader,
  createSwipeBackHandler: createIOSSwipeBackHandler,
};
