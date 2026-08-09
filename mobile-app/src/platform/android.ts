// Android-specific configuration for the CricSync mobile application
import { Platform } from 'react-native';
import { colors } from '../theme';

// Android-specific UI adjustments
export const androidConfig = {
  // Navigation bar styling for Android
  navigationBarStyle: {
    backgroundColor: colors.primary,
    elevation: 4, // Android-specific: adds shadow
  },
  
  // Tab bar styling for Android
  tabBarStyle: {
    backgroundColor: 'white',
    elevation: 8,
    height: 56, // Standard Android bottom navigation height
  },
  
  // Button styling for Android
  buttonStyle: {
    borderRadius: 4, // Less rounded corners for Android Material Design
    paddingVertical: 8,
  },
  
  // Input styling for Android
  inputStyle: {
    borderRadius: 4,
    backgroundColor: 'white',
  },
  
  // Card styling for Android
  cardStyle: {
    borderRadius: 4,
    elevation: 2, // Android elevation for shadow
  },
  
  // Animation timing for Android
  animationTiming: {
    standard: 250, // Android animations are typically a bit faster
  },
  
  // Font adjustments for Android
  fontAdjustments: {
    scaleFactor: 1.0, // Base scale factor
    weightAdjustment: 0, // Android fonts typically need normal weight values
  },
  
  // Safe area insets handling for Android
  safeAreaInsets: {
    additionalTop: 0,
    additionalBottom: 0,
  },
  
  // Keyboard behavior for Android
  keyboardBehavior: {
    avoidingViewBehavior: 'height', // Android uses 'height'
    dismissMode: 'none', // Android typically doesn't dismiss keyboard on scroll
  }
};

// Export Android-specific component renderers
export const androidRenderers = {
  // Custom back button for Android
  renderBackButton: (navigation) => ({
    headerBackTitle: null, // Android doesn't show text next to back button
    headerTruncatedBackTitle: null,
    headerBackTitleVisible: false,
  }),
  
  // Custom modal presentation for Android
  modalPresentationStyle: 'overFullScreen', // Android-specific modal style
  
  // Custom action sheet for Android
  actionSheetOptions: {
    cancelButtonIndex: -1, // Android typically doesn't have cancel button in action sheets
    destructiveButtonIndex: 0,
    userInterfaceStyle: 'light',
  }
};

// Export Android-specific utilities
export const androidUtils = {
  // Handle Android-specific permissions
  requestPermissions: async (permissionType) => {
    // Android-specific permission handling would go here
    return true;
  },
  
  // Handle Android-specific deep linking
  handleDeepLink: (url) => {
    // Android-specific deep link handling would go here
    return { handled: true, route: url };
  },
  
  // Handle Android-specific notifications
  configureNotifications: () => {
    // Android-specific notification configuration would go here
    return { configured: true };
  }
};

export default {
  config: androidConfig,
  renderers: androidRenderers,
  utils: androidUtils
};
