// Platform detection utility for the CricSync mobile application
import { Platform } from 'react-native';
import iOSConfig from './ios';
import androidConfig from './android';

// Get platform-specific configuration
export const getPlatformConfig = () => {
  return Platform.OS === 'ios' ? iOSConfig.config : androidConfig.config;
};

// Get platform-specific renderers
export const getPlatformRenderers = () => {
  return Platform.OS === 'ios' ? iOSConfig.renderers : androidConfig.renderers;
};

// Get platform-specific utilities
export const getPlatformUtils = () => {
  return Platform.OS === 'ios' ? iOSConfig.utils : androidConfig.utils;
};

// Platform-specific component factory
export const createPlatformComponent = (iOSComponent, androidComponent) => {
  return Platform.OS === 'ios' ? iOSComponent : androidComponent;
};

// Platform-specific style factory
export const createPlatformStyle = (baseStyle, iOSStyle, androidStyle) => {
  const platformStyle = Platform.OS === 'ios' ? iOSStyle : androidStyle;
  return { ...baseStyle, ...platformStyle };
};

// Platform detection
export const isIOS = Platform.OS === 'ios';
export const isAndroid = Platform.OS === 'android';

// Platform version helpers
export const iOSVersion = isIOS ? parseInt(Platform.Version, 10) : 0;
export const androidVersion = isAndroid ? Platform.Version : 0;

// Platform feature detection
export const hasNotch = () => {
  // This is a simplified implementation
  // In a real app, would use a library like react-native-device-info
  return (
    (isIOS && iOSVersion >= 11) ||
    (isAndroid && androidVersion >= 28)
  );
};

// Export platform-specific constants
export const platformConstants = {
  statusBarHeight: isIOS ? 44 : 24,
  headerHeight: isIOS ? 44 : 56,
  tabBarHeight: isIOS ? 49 : 56,
  bottomInset: hasNotch() ? 34 : 0,
};

// Export platform name for conditional rendering
export const platformName = Platform.OS;

export default {
  config: getPlatformConfig(),
  renderers: getPlatformRenderers(),
  utils: getPlatformUtils(),
  constants: platformConstants,
  isIOS,
  isAndroid,
  createPlatformStyle,
  createPlatformComponent,
};
