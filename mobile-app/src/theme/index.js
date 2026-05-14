// Design tokens that mirror the web frontend (frontend/src/index.css + tailwind.config.js).
// Light is the default; dark mode flips palette to the web's `.dark` token set.
// Colors / spacing / radii match the Tailwind values used over there.

import { useColorScheme } from 'react-native';
import { useAuth } from '../store/auth';

// Same hex values as :root and .dark in frontend/src/index.css.
const lightPalette = {
  primary: '#14B8A6',
  primaryHover: '#0D9488',
  primaryTint: 'rgba(20, 184, 166, 0.10)',

  bg: '#F9FAFB',
  card: '#FFFFFF',
  surfaceAlt: '#F3F4F6',

  text: '#111827',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',

  border: '#E5E7EB',
  borderHover: '#D1D5DB',

  success: '#22C55E',
  warning: '#FB923C',
  error: '#EF4444',
  info: '#3B82F6',

  // Used for "you" chat bubbles, pinned alerts, etc.
  bubbleMine: '#14B8A6',
  bubbleMineText: '#FFFFFF',
  bubbleTheirs: '#FFFFFF',
  bubbleTheirsText: '#111827',

  // Tinted backgrounds for status pills (semi-transparent over `card`).
  successTint: 'rgba(34, 197, 94, 0.12)',
  warningTint: 'rgba(251, 146, 60, 0.12)',
  errorTint: 'rgba(239, 68, 68, 0.12)',
  infoTint: 'rgba(59, 130, 246, 0.12)',

  // Shadow color used on cards.
  shadow: '#000000',
  shadowOpacity: 0.06,
};

const darkPalette = {
  primary: '#14B8A6',
  primaryHover: '#0D9488',
  primaryTint: 'rgba(20, 184, 166, 0.15)',

  bg: '#111827',
  card: '#1F2937',
  surfaceAlt: '#374151',

  text: '#F3F4F6',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',

  border: '#374151',
  borderHover: '#4B5563',

  success: '#22C55E',
  warning: '#FB923C',
  error: '#EF4444',
  info: '#3B82F6',

  bubbleMine: '#14B8A6',
  bubbleMineText: '#FFFFFF',
  bubbleTheirs: '#374151',
  bubbleTheirsText: '#F3F4F6',

  successTint: 'rgba(34, 197, 94, 0.18)',
  warningTint: 'rgba(251, 146, 60, 0.18)',
  errorTint: 'rgba(239, 68, 68, 0.18)',
  infoTint: 'rgba(59, 130, 246, 0.18)',

  shadow: '#000000',
  shadowOpacity: 0.28,
};

// Tailwind's spacing scale (rem * 4 → px). Kept literal so screens read like
// the web JSX they're modelled on (p-6 → spacing.s6, etc.).
export const spacing = {
  s1: 4,
  s2: 8,
  s3: 12,
  s4: 16,
  s5: 20,
  s6: 24,
  s8: 32,
  s10: 40,
  s12: 48,
};

// rounded-{name} → px. Frontend cards/buttons/inputs use rounded-2xl (16px).
export const radius = {
  md: 8,
  lg: 12, // rounded-xl
  xl: 16, // rounded-2xl — the dominant value
  pill: 999,
};

export const fontFamily = {
  // Loaded in app/_layout.jsx via expo-google-fonts.
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemibold: 'Inter_600SemiBold',
  bodyBold: 'Inter_700Bold',
  display: 'Poppins_600SemiBold',
  displayBold: 'Poppins_700Bold',
};

// Tightened type scale (was xs:11 / sm:13 / base:15 / md:16 / lg:18 / xl:22 /
// xxl:28 / display:34). The original scale was scaled up for tablet-style
// readability and looked oversized on phones — page titles eating half the
// header, "live camera feed" labels rivaling H2s on the web, etc. The new
// values land closer to native iOS/Android system densities (SF/Roboto
// 13/15/17/20) so the app reads as a focused tool rather than a marketing
// page. Spacing tokens were left untouched on purpose: a lot of screens
// reference `s5`/`s6` directly, so changing those values shifts every
// padding/gap globally and would require a screen-by-screen review.
export const fontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 15,
  lg: 16,
  xl: 18,
  xxl: 22,
  display: 28,
};

// matches `.shadow-soft` (0 2px 8px rgba(0,0,0,0.06)) and the hover variant.
export function shadow(palette, level = 1) {
  if (level === 0) return {};
  const opacity = palette.shadowOpacity * (level === 2 ? 1.6 : 1);
  return {
    shadowColor: palette.shadow,
    shadowOpacity: opacity,
    shadowRadius: level === 2 ? 16 : 8,
    shadowOffset: { width: 0, height: level === 2 ? 4 : 2 },
    elevation: level === 2 ? 4 : 2,
  };
}

// Theme preference: 'light' | 'dark' | 'system'. Stored on the auth store
// so it lives alongside the user — see store/auth.js (themePreference field).
export function useTheme() {
  const system = useColorScheme();
  const preference = useAuth((s) => s.themePreference);
  const mode = preference === 'system' ? (system ?? 'light') : preference;
  const colors = mode === 'dark' ? darkPalette : lightPalette;
  return { mode, colors, spacing, radius, fontFamily, fontSize, shadow };
}

// Synchronous fallback for places that can't use the hook (rare — only the
// root layout pre-mount). Always returns the light palette.
export const fallbackTheme = {
  colors: lightPalette,
  spacing,
  radius,
  fontFamily,
  fontSize,
};
