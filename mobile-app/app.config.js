// Expo dynamic config. Reads env at build/start time so the API + socket URL
// can be overridden without editing committed files.
// See README for how to set EXPO_PUBLIC_API_URL when running on a physical device.

const DEFAULT_API_URL = 'https://resculance.distrx.io/api/v1';

// Derive socket origin by stripping the /api/vN suffix from the API URL,
// mirroring how the web frontend builds its socket URL.
function deriveSocketUrl(apiUrl) {
  return apiUrl.replace(/\/api\/v\d+\/?$/, '');
}

module.exports = ({ config }) => {
  const apiUrl = process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;
  const socketUrl = process.env.EXPO_PUBLIC_SOCKET_URL || deriveSocketUrl(apiUrl);

  return {
    ...config,
    name: 'Resulance',
    slug: 'resulance-mobile',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'resulance',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    ios: {
      supportsTablet: true,
      bundleIdentifier: 'com.resulance.mobile',
    },
    android: {
      package: 'com.resulance.mobile',
      adaptiveIcon: {
        backgroundColor: '#E6F4FE',
        foregroundImage: './assets/images/android-icon-foreground.png',
        backgroundImage: './assets/images/android-icon-background.png',
        monochromeImage: './assets/images/android-icon-monochrome.png',
      },
      edgeToEdgeEnabled: true,
      predictiveBackGestureEnabled: false,
    },
    web: {
      output: 'static',
      favicon: './assets/images/favicon.png',
    },
    plugins: [
      'expo-router',
      'expo-secure-store',
      'expo-font',
      [
        'expo-splash-screen',
        {
          // Native splash — shown by the OS before JS loads. White bg in
          // light mode and very dark gray in dark mode, matching the
          // in-app <SplashScreen /> so the handoff is invisible. The mark
          // (red on transparent) reads cleanly on both.
          image: './assets/images/splash-icon.png',
          imageWidth: 200,
          resizeMode: 'contain',
          backgroundColor: '#FFFFFF',
          dark: { backgroundColor: '#111827' },
        },
      ],
    ],
    experiments: {
      // typedRoutes disabled — it only emits TypeScript route types.
      reactCompiler: true,
    },
    extra: {
      apiUrl,
      socketUrl,
    },
  };
};
