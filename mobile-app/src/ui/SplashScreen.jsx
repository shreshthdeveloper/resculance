// In-app splash — what the user sees after the native splash hides but
// before the auth bootstrap finishes. Light surface with the brand mark
// fading + breathing, wordmark, tagline. Matches the native splash's
// background so the handoff is invisible.

import { useEffect, useRef } from 'react';
import { Animated, Easing, View } from 'react-native';
import { useTheme } from '../theme';
import { LogoMark } from './Logo';
import { Display, Small } from './Text';

export function SplashScreen({ tagline = 'Smart Ambulance Platform' }) {
  const t = useTheme();
  const pulse = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // One-shot fade in (300ms) so the splash doesn't flash in suddenly,
    // then a continuous breathing loop on the mark.
    Animated.timing(fade, {
      toValue: 1,
      duration: 320,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 0,
          duration: 1100,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, [fade, pulse]);

  const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const markOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });

  return (
    <View
      style={{
        flex: 1,
        // Light: white; dark: same as bg. Matches the native splash colors
        // configured in app.config.js so the handoff is seamless.
        backgroundColor: t.mode === 'dark' ? '#111827' : '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        padding: t.spacing.s8,
      }}
    >
      <Animated.View
        style={{
          opacity: fade,
          alignItems: 'center',
        }}
      >
        <Animated.View style={{ opacity: markOpacity, transform: [{ scale }] }}>
          <LogoMark size={120} />
        </Animated.View>

        <View style={{ alignItems: 'center', marginTop: t.spacing.s6, gap: t.spacing.s2 }}>
          <Display style={{ letterSpacing: -0.5, fontSize: 36 }}>resculance</Display>
          <Small
            color={t.colors.textSecondary}
            style={{ textTransform: 'uppercase', letterSpacing: 2.5, fontWeight: '600' }}
          >
            {tagline}
          </Small>
        </View>
      </Animated.View>

      {/* Subtle activity bar pinned to the bottom — gives the user
          something to watch while bootstrap runs without a noisy spinner. */}
      <View
        style={{
          position: 'absolute',
          bottom: 64,
          width: 120,
          height: 3,
          borderRadius: 2,
          overflow: 'hidden',
          backgroundColor: t.mode === 'dark' ? '#1F2937' : '#F3F4F6',
        }}
      >
        <ProgressBar mode={t.mode} primary={t.colors.primary} />
      </View>
    </View>
  );
}

function ProgressBar({ mode, primary }) {
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1400,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true,
      }),
    ).start();
  }, [x]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-50, 120] });
  return (
    <Animated.View
      style={{
        width: 50,
        height: 3,
        borderRadius: 2,
        backgroundColor: primary,
        transform: [{ translateX }],
        // Soft glow in dark mode
        shadowColor: primary,
        shadowOpacity: mode === 'dark' ? 0.6 : 0,
        shadowRadius: 6,
      }}
    />
  );
}
