// shared/utils/pushNotifications.ts
// Mobile-only (imports expo-notifications/expo-constants, neither of which exist for web) - not
// actually consumed by web-app despite living under "shared", same as the rest of this directory
// (see apiClient.ts's own header comment: nothing here is cross-published, it's just mobile's own
// internal module layout). Registers this device for Expo push notifications and hands the
// resulting token to the backend. See backend/src/services/pushNotificationService.js for how the
// token gets used, and the User model for why only one token per user is stored.

import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { api } from '../api/apiClient';

// @desc  Best-effort: requests notification permission (only if not already decided - re-asking
//        after an explicit denial would just be nagging, and neither iOS nor Android re-shows
//        their own system prompt for it anyway) and, if granted, fetches this device's Expo push
//        token and PUTs it to the backend. A user who declines, or who's running somewhere push
//        isn't supported (simulator, Expo Go without a dev build on newer SDKs, web), simply keeps
//        pushToken: null server-side - the app already works fully without it, this is additive.
//        Every failure path is swallowed here on purpose: this must never crash or block login.
export async function registerForPushNotificationsAsync(): Promise<void> {
  try {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    if (existingStatus === 'undetermined') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    if (finalStatus !== 'granted') return;

    // EAS project id (app.json's extra.eas.projectId) - required by getExpoPushTokenAsync to
    // know which Expo project to mint the token for outside of Expo Go's auto-detection.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data: pushToken } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined
    );
    if (!pushToken) return;

    await api.users.updatePushToken(pushToken);
  } catch (error) {
    console.warn(
      'Push notification registration skipped:',
      error instanceof Error ? error.message : error
    );
  }
}
