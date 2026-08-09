// Integration of platform-specific components into the main CricSync application
import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';

// Import platform-specific components
import iOSComponents from './platform/ios-components';
import iOSNavigation from './platform/ios-navigation';
import iOSAnimations from './platform/ios-animations';
import androidComponents from './platform/android-components';
import androidNavigation from './platform/android-navigation';
import androidAnimations from './platform/android-animations';

// Import screens
import LoginScreen from './screens/LoginScreen';
import RegisterScreen from './screens/RegisterScreen';
import ForgotPasswordScreen from './screens/ForgotPasswordScreen';
import HomeScreen from './screens/HomeScreen';
import TeamsScreen from './screens/TeamsScreen';
import ScoringScreen from './screens/ScoringScreen';
import ShopScreen from './screens/ShopScreen';
import ProfileScreen from './screens/ProfileScreen';
import LoadingScreen from './screens/LoadingScreen';

// Import theme
import { CricSyncTheme, colors } from './theme';

// Import contexts
import { CartProvider } from './contexts/CartContext';
import { useAuth } from './hooks/useAuth';

// Create platform-specific components
const PlatformButton = Platform.OS === 'ios' ? iOSComponents.Button : androidComponents.Button;
const PlatformCard = Platform.OS === 'ios' ? iOSComponents.Card : androidComponents.Card;
const PlatformTextInput = Platform.OS === 'ios' ? iOSComponents.TextInput : androidComponents.TextInput;
const PlatformTabs = Platform.OS === 'ios' ? iOSComponents.SegmentedControl : androidComponents.Tabs;
const PlatformBackButton = Platform.OS === 'ios' ? iOSNavigation.BackButton : androidNavigation.BackButton;
const PlatformHeaderConfig = Platform.OS === 'ios' ? iOSNavigation.headerConfig : androidNavigation.headerConfig;
const PlatformTabConfig = Platform.OS === 'ios' ? iOSNavigation.tabConfig : androidNavigation.tabConfig;
const PlatformTransitionConfig = Platform.OS === 'ios' ? iOSNavigation.transitionConfig : androidNavigation.transitionConfig;

// Create navigation stacks
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Auth Navigator
const AuthNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        ...PlatformHeaderConfig,
        ...PlatformTransitionConfig,
      }}
    >
      <Stack.Screen 
        name="Login" 
        component={LoginScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="Register" 
        component={RegisterScreen} 
        options={{ headerShown: false }}
      />
      <Stack.Screen 
        name="ForgotPassword" 
        component={ForgotPasswordScreen} 
        options={{ title: 'Forgot Password' }}
      />
    </Stack.Navigator>
  );
};

// Main Tab Navigator
const MainTabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        ...PlatformHeaderConfig,
        ...PlatformTabConfig,
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ 
          title: 'CricSync',
        }}
      />
      <Tab.Screen 
        name="Teams" 
        component={TeamsScreen}
        options={{ title: 'Teams' }}
      />
      <Tab.Screen 
        name="Scoring" 
        component={ScoringScreen}
        options={{ title: 'Scoring' }}
      />
      <Tab.Screen 
        name="Shop" 
        component={ShopScreen}
        options={{ title: 'Shop' }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ title: 'Profile' }}
      />
    </Tab.Navigator>
  );
};

// App Navigator
const AppNavigator = () => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer>
      {isAuthenticated ? <MainTabNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
};

// Main App Component
export default function IntegratedApp() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={CricSyncTheme}>
        <CartProvider>
          <AppNavigator />
        </CartProvider>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

// Export platform-specific components for use throughout the app
export {
  PlatformButton,
  PlatformCard,
  PlatformTextInput,
  PlatformTabs,
  PlatformBackButton,
};
