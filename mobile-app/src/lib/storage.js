// Token storage — SecureStore on native, AsyncStorage on web (SecureStore is
// iOS/Android only). Same async interface either way so callers don't care.

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const native = Platform.OS === 'ios' || Platform.OS === 'android';

export async function getItem(key) {
  if (native) return SecureStore.getItemAsync(key);
  return AsyncStorage.getItem(key);
}

export async function setItem(key, value) {
  if (native) {
    await SecureStore.setItemAsync(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

export async function removeItem(key) {
  if (native) {
    await SecureStore.deleteItemAsync(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

export const StorageKeys = {
  accessToken: 'rsl_access_token',
  refreshToken: 'rsl_refresh_token',
  user: 'rsl_user',
  // Superadmin only — the org they're currently "viewing as". The mobile
  // app is org-scoped for paramedics (the backend reads orgId from their
  // JWT), but superadmin has no org of their own, so we ask them to pick
  // one before any org-scoped screen will load data.
  activeOrg: 'rsl_active_org',
};
