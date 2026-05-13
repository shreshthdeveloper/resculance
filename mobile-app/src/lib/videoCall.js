// Video call helpers — the web uses Jitsi Meet hosted on meet.jit.si with
// a per-session room name. We mirror the exact same room convention so a
// paramedic on mobile joins the same room as a doctor on the web.
//
// Two open strategies:
//   - openJitsiNative: uses the Jitsi `jitsi-meet:` deep link, which
//     launches the Jitsi Meet app if installed.
//   - openJitsiWeb:    falls back to https://meet.jit.si/<room>, which
//     opens in the system browser (or Jitsi via universal link if set up).
//
// `openVideoCall` tries native first then falls back to web.

import { Linking, Platform } from 'react-native';

// Match the web frontend's room prefix exactly:
//   frontend/src/config/jitsiConfig.js → roomPrefix: 'resculance-session-'
const JITSI_DOMAIN = 'meet.jit.si';
const ROOM_PREFIX = 'resculance-session-';

export function buildJitsiRoom(sessionId) {
  return `${ROOM_PREFIX}${String(sessionId)}`;
}

export function buildJitsiWebUrl(sessionId, displayName) {
  const room = buildJitsiRoom(sessionId);
  const params = new URLSearchParams();
  if (displayName) {
    // Jitsi reads ?displayName via #userInfo.displayName in newer builds,
    // but the simplest cross-version approach is to pass it as a config
    // override via fragment. Keep it simple — most users just type their
    // name on the prejoin screen.
    params.set('displayName', displayName);
  }
  const qs = params.toString();
  return `https://${JITSI_DOMAIN}/${room}${qs ? `#userInfo.displayName="${encodeURIComponent(displayName)}"` : ''}`;
}

function buildJitsiNativeUrl(sessionId) {
  // The Jitsi app honors:  jitsi-meet://<domain>/<room>
  const room = buildJitsiRoom(sessionId);
  return `jitsi-meet://${JITSI_DOMAIN}/${room}`;
}

/**
 * Open the video call for a session. Tries the Jitsi app first via deep
 * link; if it's not installed, opens the meet.jit.si web room in the
 * system browser.
 *
 * @returns {Promise<{opened: boolean, url: string}>}
 */
export async function openVideoCall(sessionId, displayName) {
  // iOS requires the LSApplicationQueriesSchemes entry for canOpenURL to
  // return true on custom schemes (`jitsi-meet`). Without that entry it
  // returns false even when the app is installed. We fall back to the
  // browser URL in that case, which still works because of Jitsi's
  // universal-link handling on installed devices.
  const nativeUrl = buildJitsiNativeUrl(sessionId);
  const webUrl = buildJitsiWebUrl(sessionId, displayName);
  try {
    if (Platform.OS !== 'web') {
      const can = await Linking.canOpenURL(nativeUrl).catch(() => false);
      if (can) {
        await Linking.openURL(nativeUrl);
        return { opened: true, url: nativeUrl };
      }
    }
    await Linking.openURL(webUrl);
    return { opened: true, url: webUrl };
  } catch {
    return { opened: false, url: webUrl };
  }
}
