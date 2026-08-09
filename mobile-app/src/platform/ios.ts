// iOS-specific configuration for the CricSync mobile application
import { Platform } from 'react-native';
import { colors } from '../theme';

// iOS-specific UI adjustments
export const iOSConfig = {
  // Navigation bar styling for iOS
  navigationBarStyle: {
    backgroundColor: colors.primary,
    shadowColor: 'transparent', // iOS-specific: removes shadow
  },
  
  // Tab bar styling for iOS
  tabBarStyle: {
    backgroundColor: 'white',
    borderTopWidth: 0.5,
    borderTopColor: colors.border,
    paddingBottom: Platform.OS === 'ios' ? 20 : 0, // Extra padding for iOS devices with home indicator
  },
  
  // Button styling for iOS
  buttonStyle: {
    borderRadius: 10, // More rounded corners for iOS
    paddingVertical: 12,
  },
  
  // Input styling for iOS
  inputStyle: {
    borderRadius: 10,
    backgroundColor: '#f9f9f9',
  },
  
  // Card styling for iOS
  cardStyle: {
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 0, // No elevation on iOS
  },
  
  // Animation timing for iOS
  animationTiming: {
    standard: 300, // iOS animations are typically a bit slower
  },
  
  // Font adjustments for iOS
  fontAdjustments: {
    scaleFactor: 1.0, // Base scale factor
    weightAdjustment: 100, // iOS fonts typically need higher weight values
  },
  
  // Safe area insets handling for iOS
  safeAreaInsets: {
    additionalTop: 0,
    additionalBottom: 10, // Extra bottom padding for iOS
  },
  
  // Keyboard behavior for iOS
  keyboardBehavior: {
    avoidingViewBehavior: 'padding', // iOS uses 'padding'
    dismissMode: 'on-drag', // Dismiss keyboard when scrolling
  }
};

// Export iOS-specific component renderers
export const iOSRenderers = {
  // Custom back button for iOS
  renderBackButton: (navigation) => ({
    headerBackTitle: 'Back', // iOS shows text next to back button
    headerTruncatedBackTitle: 'Back',
    headerBackTitleVisible: true,
  }),
  
  // Custom modal presentation for iOS
  modalPresentationStyle: 'formSheet', // iOS-specific modal style
  
  // Custom action sheet for iOS
  actionSheetOptions: {
    cancelButtonIndex: 0,
    destructiveButtonIndex: 1,
    userInterfaceStyle: 'light',
  }
};

// Export iOS-specific utilities
export const iOSUtils = {
  // Handle iOS-specific permissions
  requestPermissions: async (permissionType) => {
    // iOS-specific permission handling would go here
    return true;
  },
  
  // Handle iOS-specific deep linking
  handleDeepLink: (url) => {
    // iOS-specific deep link handling would go here
    return { handled: true, route: url };
  },
  
  // Handle iOS-specific notifications
  configureNotifications: () => {
    // iOS-specific notification configuration would go here
    return { configured: true };
  }
};

export default {
  config: iOSConfig,
  renderers: iOSRenderers,
  utils: iOSUtils
};
