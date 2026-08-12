# CricRoots Mobile Application Development Documentation

## Overview

This document provides comprehensive documentation for the CricRoots mobile application development process. It covers the architecture, shared code strategy, platform-specific implementations, and guidelines for future development.

## Table of Contents

1. [Project Structure](#project-structure)
2. [Shared Code Strategy](#shared-code-strategy)
3. [Platform-Specific Implementations](#platform-specific-implementations)
4. [Authentication Flow](#authentication-flow)
5. [Navigation Structure](#navigation-structure)
6. [UI Components and Styling](#ui-components-and-styling)
7. [State Management](#state-management)
8. [API Integration](#api-integration)
9. [Testing Guidelines](#testing-guidelines)
10. [Deployment Process](#deployment-process)
11. [Future Development Roadmap](#future-development-roadmap)

## Project Structure

The CricRoots mobile application follows a well-organized structure to facilitate maintainability and scalability:

```
/CricRoots
├── /assets                 # Static assets like images and fonts
├── /src
│   ├── /components         # Reusable UI components
│   ├── /contexts           # React context providers
│   ├── /hooks              # Custom React hooks
│   ├── /navigation         # Navigation configuration
│   ├── /platform           # Platform-specific code (iOS/Android)
│   ├── /screens            # Screen components
│   ├── /shared             # Shared code with web application
│   │   ├── /api            # API client and endpoints
│   │   ├── /contexts       # Shared context definitions
│   │   ├── /hooks          # Shared hook factories
│   │   ├── /types          # TypeScript type definitions
│   │   └── /utils          # Utility functions
│   └── /theme              # Theming and styling
├── App.tsx                 # Main application component
├── app.json                # Expo configuration
└── package.json            # Dependencies and scripts
```

## Shared Code Strategy

The CricRoots mobile application implements a comprehensive shared code strategy with the web application to maximize code reuse and ensure consistency across platforms.

### Shared Types

Common type definitions are shared between web and mobile applications to ensure consistency in data structures:

```typescript
// Example from /shared/types/index.ts
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  teams: string[];
  profileImage?: string | null;
}
```

### Shared API Client

A common API client is used across platforms with platform-specific implementations for network requests:

```typescript
// Example from /shared/api/apiClient.ts
export const authAPI = {
  login: (email: string, password: string) => 
    fetchAPI<{ user: User; token: string }>('/auth/login', 'POST', { email, password }),
  
  register: (userData: Partial<User>, password: string) => 
    fetchAPI<{ user: User; token: string }>('/auth/register', 'POST', { ...userData, password }),
  
  // ...other auth endpoints
};
```

### Shared Hooks and Contexts

React hooks and contexts are implemented as factories that accept platform-specific dependencies:

```typescript
// Example from /shared/hooks/useAuth.ts
export function createUseAuth(storage: StorageInterface): () => UseAuthReturn {
  return function useAuth(): UseAuthReturn {
    // Implementation that uses the provided storage interface
  };
}
```

### Shared Utilities

Common utility functions are shared across platforms:

```typescript
// Example from /shared/utils/formatters.ts
export function formatDate(dateString: string, format: 'short' | 'medium' | 'long' = 'medium'): string {
  // Implementation that works on both platforms
}
```

## Platform-Specific Implementations

### iOS-Specific Adaptations

iOS-specific configurations are defined in `/platform/ios.ts` and include:

- UI adjustments for iOS design patterns
- iOS-specific component renderers
- iOS-specific utilities for permissions, deep linking, etc.

```typescript
// Example from /platform/ios.ts
export const iOSConfig = {
  navigationBarStyle: {
    backgroundColor: colors.primary,
    shadowColor: 'transparent', // iOS-specific: removes shadow
  },
  // ...other iOS-specific configurations
};
```

### Android-Specific Adaptations

Android-specific configurations are defined in `/platform/android.ts` and include:

- UI adjustments for Material Design
- Android-specific component renderers
- Android-specific utilities for permissions, deep linking, etc.

```typescript
// Example from /platform/android.ts
export const androidConfig = {
  navigationBarStyle: {
    backgroundColor: colors.primary,
    elevation: 4, // Android-specific: adds shadow
  },
  // ...other Android-specific configurations
};
```

## Authentication Flow

The authentication flow in the CricRoots mobile application is implemented using React Navigation and the shared authentication hook:

1. **AppNavigator**: The root navigator that determines whether to show the authentication flow or the main application based on the user's authentication state.

2. **AuthNavigator**: Handles navigation between authentication screens (Login, Register, ForgotPassword).

3. **Authentication Screens**:
   - **LoginScreen**: Allows users to log in with email and password
   - **RegisterScreen**: Allows users to create a new account
   - **ForgotPasswordScreen**: Allows users to reset their password

4. **Authentication State Management**: Implemented using the shared `useAuth` hook with platform-specific storage (SecureStore for iOS/Android).

## Navigation Structure

The CricRoots mobile application uses React Navigation for navigation:

1. **AppNavigator**: The root navigator that handles authentication state.

2. **AuthNavigator**: Stack navigator for authentication screens.

3. **MainTabNavigator**: Bottom tab navigator for the main application screens:
   - Home
   - Teams
   - Scoring
   - Shop
   - Profile

4. **Screen-Specific Stack Navigators**: Each main tab can have its own stack navigator for nested screens.

## UI Components and Styling

The CricRoots mobile application uses React Native Paper for UI components and a consistent theming system:

1. **Theme Configuration**: Defined in `/theme/index.ts` with CricRoots brand colors and common styles.

2. **Platform-Specific Styling**: Applied using the platform-specific configurations.

3. **Common Components**: Reusable components are defined in the `/components` directory.

4. **Screen Components**: Screen-specific components are defined in the `/screens` directory.

## State Management

The CricRoots mobile application uses a combination of React Context and local state for state management:

1. **Authentication State**: Managed by the `useAuth` hook.

2. **Cart State**: Managed by the `CartContext` provider.

3. **Screen-Specific State**: Managed using local state with React's `useState` and `useReducer` hooks.

4. **Form State**: Managed using local state with validation logic.

## API Integration

The CricRoots mobile application integrates with the backend API using the shared API client:

1. **API Client**: Defined in `/shared/api/apiClient.ts` with endpoints for all required functionality.

2. **Authentication**: API calls include authentication tokens when required.

3. **Error Handling**: Consistent error handling across the application.

4. **Loading States**: Loading indicators are shown during API calls.

## Testing Guidelines

The CricRoots mobile application should be tested thoroughly:

1. **Unit Testing**: Test individual components and functions.

2. **Integration Testing**: Test interactions between components.

3. **End-to-End Testing**: Test complete user flows.

4. **Platform-Specific Testing**: Test on both iOS and Android devices.

5. **Device Testing**: Test on different device sizes and orientations.

## Deployment Process

The deployment process for the CricRoots mobile application involves:

1. **Building the Application**: Using Expo or React Native CLI.

2. **Testing the Build**: On real devices before submission.

3. **App Store Submission**: For iOS deployment.

4. **Google Play Store Submission**: For Android deployment.

5. **Beta Testing**: Using TestFlight for iOS and Google Play Beta for Android.

## Future Development Roadmap

The future development roadmap for the CricRoots mobile application includes:

1. **Feature Enhancements**:
   - Offline support
   - Push notifications
   - In-app purchases
   - Advanced statistics and analytics

2. **Performance Optimizations**:
   - Reducing bundle size
   - Improving load times
   - Optimizing animations

3. **Platform Expansions**:
   - Tablet-specific layouts
   - Wearable device integration
   - TV app versions

4. **Integration Enhancements**:
   - Social media sharing
   - Calendar integration
   - Location services
   - Live streaming

This documentation will be continuously updated as the application evolves.
