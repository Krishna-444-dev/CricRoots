// Integration of iOS components into the main CricSync application
import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Provider as PaperProvider } from 'react-native-paper';

// Import platform-specific components
import iOSComponents from './ios-components';
import iOSNavigation from './ios-navigation';
import iOSAnimations from './ios-animations';
import androidComponents from './android-components';
import androidNavigation from './android-navigation';
import androidAnimations from './android-animations';

// Import screens
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import HomeScreen from '../screens/HomeScreen';
import TeamsScreen from '../screens/TeamsScreen';
import ScoringScreen from '../screens/ScoringScreen';
import ShopScreen from '../screens/ShopScreen';
import ProfileScreen from '../screens/ProfileScreen';

// Import theme
import { CricSyncTheme, colors } from '../theme';

// Import contexts
import { CartProvider } from '../contexts/CartContext';
import { useAuth } from '../hooks/useAuth';

// Create platform-specific components
const PlatformButton = Platform.OS === 'ios' ? iOSComponents.Button : androidComponents.Button;
const PlatformCard = Platform.OS === 'ios' ? iOSComponents.Card : androidComponents.Card;
const PlatformTextInput = Platform.OS === 'ios' ? iOSComponents.TextInput : androidComponents.TextInput;
const PlatformBackButton = Platform.OS === 'ios' ? iOSNavigation.BackButton : androidNavigation.BackButton;
const PlatformHeader = Platform.OS === 'ios' ? iOSNavigation.Header : androidNavigation.Header;
const PlatformTabBar = Platform.OS === 'ios' ? iOSNavigation.TabBar : androidNavigation.TabBar;
const PlatformFadeIn = Platform.OS === 'ios' ? iOSAnimations.FadeIn : androidAnimations.FadeIn;
const PlatformSlideIn = Platform.OS === 'ios' ? iOSAnimations.SlideIn : androidAnimations.SlideIn;

// Create navigation stacks
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Auth Navigator
const AuthNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: 'white',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
        headerLeft: (props) => Platform.OS === 'ios' ? <PlatformBackButton {...props} /> : null,
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
      tabBar={(props) => <PlatformTabBar {...props} />}
      screenOptions={({ route }) => ({
        headerStyle: {
          backgroundColor: colors.primary,
        },
        headerTintColor: 'white',
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen 
        name="Home" 
        component={HomeScreen} 
        options={{ 
          title: 'CricSync',
          headerTitle: (props) => <PlatformHeader title="CricSync" largeTitle={Platform.OS === 'ios'} {...props} />
        }}
      />
      <Tab.Screen 
        name="Teams" 
        component={TeamsScreen}
        options={{ 
          headerTitle: (props) => <PlatformHeader title="Teams" largeTitle={Platform.OS === 'ios'} {...props} />
        }}
      />
      <Tab.Screen 
        name="Scoring" 
        component={ScoringScreen}
        options={{ 
          headerTitle: (props) => <PlatformHeader title="Scoring" largeTitle={Platform.OS === 'ios'} {...props} />
        }}
      />
      <Tab.Screen 
        name="Shop" 
        component={ShopScreen}
        options={{ 
          headerTitle: (props) => <PlatformHeader title="Shop" largeTitle={Platform.OS === 'ios'} {...props} />
        }}
      />
      <Tab.Screen 
        name="Profile" 
        component={ProfileScreen}
        options={{ 
          headerTitle: (props) => <PlatformHeader title="Profile" largeTitle={Platform.OS === 'ios'} {...props} />
        }}
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
  PlatformBackButton,
  PlatformHeader,
  PlatformTabBar,
  PlatformFadeIn,
  PlatformSlideIn,
};
