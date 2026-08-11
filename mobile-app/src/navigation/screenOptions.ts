// Shared native-stack header styling so every stack navigator looks consistent with the
// Stadium Dark theme, instead of each screen re-declaring the same header colors.
import { colors } from '../theme';

export const navScreenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.ink,
  headerTitleStyle: { fontWeight: '700' as const },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: colors.background },
};
