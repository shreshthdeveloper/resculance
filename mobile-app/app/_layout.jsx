// Root layout — handles three startup concerns in order:
//   1. Native splash stays visible until fonts + auth bootstrap finish.
//   2. While the JS splash is up we render our branded <SplashScreen />.
//   3. Once ready, we install the auth redirect effect (login ↔ tabs).
//
// expo-router renders this above every other route, so it's the only place
// we set up font loading, the API client's onUnauthorized hook, and the
// shared Stack header style.

import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
  useFonts,
} from '@expo-google-fonts/inter';
import {
  Poppins_600SemiBold,
  Poppins_700Bold,
} from '@expo-google-fonts/poppins';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as NativeSplash from 'expo-splash-screen';
import { useEffect, useMemo } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { setAuthContextProvider, setOnUnauthorized } from '../src/api/client';
import { useAuth } from '../src/store/auth';
import { useTheme } from '../src/theme';
import { SplashScreen } from '../src/ui';

NativeSplash.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  const status = useAuth((s) => s.status);
  const bootstrap = useAuth((s) => s.bootstrap);
  const signOut = useAuth((s) => s.signOut);

  useEffect(() => {
    bootstrap();
    // The API client invokes this when refresh-token fails; we route back
    // to /login via state change (signOut() flips `status`).
    setOnUnauthorized(() => signOut());
    // Let the API client read the current role + active org id on every
    // request (used to auto-attach ?organizationId for superadmin).
    setAuthContextProvider(() => {
      const { user, activeOrg } = useAuth.getState();
      return { role: user?.role ?? null, activeOrgId: activeOrg?.id ?? null };
    });
  }, [bootstrap, signOut]);

  // Hide the native splash once both fonts are resolved (loaded or errored)
  // AND the auth bootstrap is no longer in the 'loading' state. After that
  // the in-app branded splash (rendered in <Inner/>) takes over briefly.
  const ready = (fontsLoaded || fontError) && status !== 'loading';
  useEffect(() => {
    if (ready) NativeSplash.hideAsync().catch(() => {});
  }, [ready]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <Inner ready={ready} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function Inner({ ready }) {
  const t = useTheme();
  const status = useAuth((s) => s.status);
  const router = useRouter();
  const segments = useSegments();

  // Auth-driven redirect: bounce to /login when unauthenticated, away from
  // /login when already signed in.
  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === 'login';
    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/login');
    } else if (status === 'authenticated' && inAuthGroup) {
      router.replace('/');
    }
  }, [ready, status, segments, router]);

  const headerStyles = useMemo(
    () => ({
      headerStyle: { backgroundColor: t.colors.card },
      headerTitleStyle: {
        color: t.colors.text,
        fontFamily: t.fontFamily.bodySemibold,
        fontWeight: '600',
      },
      headerTintColor: t.colors.primary,
      headerShadowVisible: false,
    }),
    [t],
  );

  if (!ready) return <SplashScreen />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: t.colors.bg },
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen
        name="session/[id]"
        options={{ headerShown: true, title: 'Session', ...headerStyles }}
      />
      <Stack.Screen
        name="patient/[id]"
        options={{ headerShown: true, title: 'Patient', ...headerStyles }}
      />
      <Stack.Screen
        name="onboard/index"
        options={{ headerShown: true, title: 'Onboard patient', ...headerStyles }}
      />
      <Stack.Screen
        name="onboard/new-patient"
        options={{ headerShown: true, title: 'New patient', ...headerStyles }}
      />
      <Stack.Screen
        name="onboard/[patientId]"
        options={{ headerShown: true, title: 'Confirm onboarding', ...headerStyles }}
      />
      <Stack.Screen
        name="settings"
        options={{ headerShown: true, title: 'Settings', ...headerStyles }}
      />
      <Stack.Screen
        name="about"
        options={{ headerShown: true, title: 'About', ...headerStyles }}
      />
    </Stack>
  );
}
