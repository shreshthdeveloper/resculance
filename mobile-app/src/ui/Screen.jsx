// Screen — root wrapper for every route. Applies the theme background,
// safe-area insets, and a status-bar style matching light/dark mode.

import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

// `edges` defaults to `[]` because most callers either (a) sit inside the
// tab navigator (which already insets for the tab bar + status bar) or
// (b) sit inside a Stack with a header (which handles the top inset).
// Stack-pushed screens without a header should pass `['bottom']` or
// `['top','bottom']` explicitly.
export function Screen({
  children,
  edges = [],
  padded = false,
  style,
}) {
  const { colors, spacing, mode } = useTheme();
  return (
    <>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <SafeAreaView
        edges={edges}
        style={[
          { flex: 1, backgroundColor: colors.bg },
          padded && { padding: spacing.s5 },
          style,
        ]}
      >
        {children}
      </SafeAreaView>
    </>
  );
}

// A plain View variant when the screen already lives inside a SafeAreaView
// (e.g. modals inside the route stack).
export function ScreenView({ children, padded = false, style }) {
  const { colors, spacing } = useTheme();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: colors.bg },
        padded && { padding: spacing.s5 },
        style,
      ]}
    >
      {children}
    </View>
  );
}
