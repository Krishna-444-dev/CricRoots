// CricSync "Stadium Dark" theme - mirrors web-app/tailwind.config.js exactly, so the brand
// looks and feels the same across web, iOS, and Android.
import { MD3DarkTheme as DefaultTheme } from 'react-native-paper';

export const colors = {
  background: '#0B1220',
  surface: '#131C2E',
  surfaceHover: '#1A2338',
  surfaceAlt: '#1E2841',

  border: '#243049',
  borderStrong: '#2F3E5C',

  ink: '#F1F5F9',
  inkSecondary: '#96A3BC',
  inkMuted: '#6B7A99',

  pitch400: '#4ADE80',
  pitch500: '#22C55E',
  pitch600: '#16A34A',
  pitch700: '#15803D',
  pitch900: '#0D3B22',

  gold400: '#FBBF24',
  gold500: '#F5A623',
  gold600: '#D97706',

  wicket400: '#F87171',
  wicket500: '#EF4444',
  wicket600: '#DC2626',

  // Legacy aliases kept for any not-yet-migrated screens/styles that reference generic names.
  primary: '#22C55E',
  secondary: '#F5A623',
  error: '#EF4444',
  success: '#22C55E',
  warning: '#F5A623',
  info: '#38BDF8',
  text: '#F1F5F9',
  textSecondary: '#96A3BC',
};

export const CricSyncTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.pitch500,
    primaryContainer: colors.pitch900,
    secondary: colors.gold500,
    secondaryContainer: colors.gold600,
    error: colors.wicket500,
    background: colors.background,
    surface: colors.surface,
    surfaceVariant: colors.surfaceAlt,
    onSurface: colors.ink,
    onBackground: colors.ink,
    outline: colors.border,
  },
  roundness: 12,
  fonts: DefaultTheme.fonts,
};

export const commonStyles = {
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  card: {
    margin: 16,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
  },
  header: {
    padding: 16,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold' as const,
    color: colors.ink,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold' as const,
    marginBottom: 16,
    color: colors.ink,
  },
  button: {
    marginVertical: 8,
    backgroundColor: colors.pitch500,
    borderRadius: 10,
  },
  buttonOutline: {
    marginVertical: 8,
    borderColor: colors.pitch500,
    borderRadius: 10,
  },
  textInput: {
    marginVertical: 8,
    backgroundColor: colors.surfaceAlt,
  },
  errorText: {
    color: colors.wicket400,
    fontSize: 14,
    marginTop: 4,
  },
};
