// Push notification setup — safe in Expo Go, fully functional in dev/prod builds.
//
// Why the gymnastics:
//   - SDK 53 removed Expo Go support for Android push (FCM moved out of the
//     Expo Go binary). Just *importing* expo-notifications at the top of
//     this file is what surfaces the warning; the module side-effects fire
//     on load. So we never static-import it — we lazy-require inside
//     functions and bail when running under Expo Go.
//   - Expo Go on iOS still doesn't support remote push tokens for newer
//     SDKs either.
//   - Standalone dev / production builds work normally.
//
// Resulting contract:
//   - `registerForPushNotifications()` resolves to a token string in a real
//     build, or null in Expo Go / on web / on simulators. Never throws.
//   - `onNotificationTap()` / `onNotificationReceived()` install listeners
//     when supported, no-op otherwise. They return a teardown function.

import Constants from 'expo-constants';
import { Platform } from 'react-native';

let cachedToken = null;

// `Constants.appOwnership === 'expo'` is set when running inside Expo Go.
// `'standalone'` (legacy) / `null` indicate a real build. SDK 50+ also
// exposes `Constants.executionEnvironment === 'storeClient'` — same thing.
function isExpoGo() {
  return (
    Constants.appOwnership === 'expo' ||
    Constants.executionEnvironment === 'storeClient'
  );
}

function canDoPush() {
  if (Platform.OS === 'web') return false;
  if (isExpoGo()) return false;
  return true;
}

// Lazy module getters — never imported at module top so Expo Go doesn't
// emit its compatibility warning on every reload.
function loadNotifications() {
  return require('expo-notifications');
}
function loadDevice() {
  return require('expo-device');
}

let handlerInstalled = false;
function installForegroundHandler() {
  if (handlerInstalled) return;
  if (!canDoPush()) return;
  try {
    const Notifications = loadNotifications();
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
      }),
    });
    handlerInstalled = true;
  } catch {}
}

export function getCachedPushToken() {
  return cachedToken;
}

/**
 * Asks for notification permission and returns the Expo push token. Safe
 * to call multiple times — once a token is cached we skip re-asking.
 *
 * @returns {Promise<string|null>} the Expo push token, or null when not supported.
 */
export async function registerForPushNotifications() {
  if (!canDoPush()) return null;
  if (cachedToken) return cachedToken;

  try {
    const Notifications = loadNotifications();
    const Device = loadDevice();

    // Simulators / web do not support remote push tokens.
    if (!Device.isDevice) return null;

    installForegroundHandler();

    const settings = await Notifications.getPermissionsAsync();
    let status = settings.status;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    // Android needs an explicit channel before notifications render.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Resulance',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#14B8A6',
      });
    }

    // ExpoPushToken is independent of FCM/APNS credentials — works against
    // the Expo push service. If you switch to a self-hosted FCM/APNS
    // pipeline, call getDevicePushTokenAsync() instead.
    const projectId =
      Constants.expoConfig?.extra?.eas?.projectId ??
      Constants.easConfig?.projectId ??
      undefined;
    const token = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    cachedToken = token.data ?? null;
    return cachedToken;
  } catch {
    return null;
  }
}

/**
 * Wire a callback for foreground notification taps. Returns a teardown.
 * No-op (and returns a no-op teardown) on platforms where push isn't
 * supported.
 */
export function onNotificationTap(cb) {
  if (!canDoPush()) return () => {};
  try {
    installForegroundHandler();
    const Notifications = loadNotifications();
    const sub = Notifications.addNotificationResponseReceivedListener((resp) => {
      try { cb(resp.notification.request.content); } catch {}
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}

/**
 * Wire a callback for received foreground notifications. Returns a teardown.
 */
export function onNotificationReceived(cb) {
  if (!canDoPush()) return () => {};
  try {
    installForegroundHandler();
    const Notifications = loadNotifications();
    const sub = Notifications.addNotificationReceivedListener((n) => {
      try { cb(n.request.content); } catch {}
    });
    return () => sub.remove();
  } catch {
    return () => {};
  }
}
