// Skeleton — animated placeholder block. Pulses opacity to signal "loading"
// without the harsh "spinner stops the whole screen" feel.
//
// Used inside list-style screens (Sessions, Ambulance, Notifications, Home)
// where we already know roughly what the data will look like, so we can
// render the right shape immediately and swap in real content when ready.

import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

export function Skeleton({ width = '100%', height = 14, radius = 8, style }) {
  const t = useTheme();
  const o = useSharedValue(0.6);

  useEffect(() => {
    o.value = withRepeat(withTiming(1, { duration: 700 }), -1, true);
  }, [o]);

  const animStyle = useAnimatedStyle(() => ({ opacity: o.value }));

  return (
    <Animated.View
      style={[
        {
          width,
          height,
          borderRadius: radius,
          backgroundColor: t.colors.surfaceAlt,
        },
        animStyle,
        style,
      ]}
    />
  );
}

// Convenience: a card-shaped skeleton matching the dominant list-row layout
// (icon block + 2 lines + status pill). Reuses `Skeleton`.
export function SkeletonRow() {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.s3,
        padding: t.spacing.s4,
        backgroundColor: t.colors.card,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.colors.border,
      }}
    >
      <Skeleton width={44} height={44} radius={22} />
      <View style={{ flex: 1, gap: 6 }}>
        <Skeleton width="60%" height={14} />
        <Skeleton width="40%" height={12} />
      </View>
      <Skeleton width={64} height={20} radius={10} />
    </View>
  );
}

export function SkeletonStatGrid({ count = 4 }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s3 }}>
      {Array.from({ length: count }).map((_, i) => (
        <View
          key={i}
          style={{
            width: '48%',
            padding: t.spacing.s4,
            backgroundColor: t.colors.card,
            borderRadius: t.radius.xl,
            borderWidth: 1,
            borderColor: t.colors.border,
            gap: 8,
          }}
        >
          <Skeleton width={36} height={36} radius={10} />
          <Skeleton width="60%" height={22} />
          <Skeleton width="80%" height={12} />
        </View>
      ))}
    </View>
  );
}
