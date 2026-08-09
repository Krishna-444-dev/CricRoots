// Mobile-specific theme configuration
import { MD3LightTheme as DefaultTheme } from 'react-native-paper';

// CricSync brand colors
const colors = {
  primary: '#1e88e5',
  primaryDark: '#0d47a1',
  primaryLight: '#64b5f6',
  secondary: '#ff9800',
  secondaryDark: '#f57c00',
  secondaryLight: '#ffb74d',
  error: '#f44336',
  success: '#4caf50',
  warning: '#ff9800',
  info: '#2196f3',
  background: '#f5f5f5',
  surface: '#ffffff',
  text: '#212121',
  textSecondary: '#757575',
  border: '#e0e0e0',
};

// Create the CricSync theme
export const CricSyncTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.primary,
    primaryContainer: colors.primaryLight,
    secondary: colors.secondary,
    secondaryContainer: colors.secondaryLight,
    error: colors.error,
    background: colors.background,
    surface: colors.surface,
    onSurface: colors.text,
    onBackground: colors.text,
  },
  roundness: 8,
  fonts: DefaultTheme.fonts,
};

// Export colors for use throughout the app
export { colors };

// Export common styles
export const commonStyles = {
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    margin: 16,
    elevation: 2,
  },
  header: {
    padding: 16,
    backgroundColor: colors.primary,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: 'white',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
  },
  button: {
    marginVertical: 8,
    backgroundColor: colors.primary,
  },
  buttonOutline: {
    marginVertical: 8,
    borderColor: colors.primary,
  },
  textInput: {
    marginVertical: 8,
    backgroundColor: 'white',
  },
  errorText: {
    color: colors.error,
    fontSize: 14,
    marginTop: 4,
  },
};
