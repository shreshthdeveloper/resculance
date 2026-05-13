// Custom bottom tab bar — design refresh.
//
// What's on screen:
//   - A 3px primary-teal pill indicator that lives at the TOP of the bar
//     and translates between tab slots with a spring. Material-3 inspired.
//     Top-anchored so it never overlaps icons.
//   - Filled icon variants when active, outlined when inactive. The active
//     icon gets a subtle scale-up via a Reanimated spring for delight.
//   - Labels: medium muted when inactive, semibold primary when active.
//   - Hairline top border on the bar; soft shadow above to lift it off
//     the page.
//   - Haptic selection feedback on tap (existing behaviour).
//
// The Alerts unread badge moved to the top-bar bell, so this component no
// longer renders one. The four tabs (Home / Onboard / Sessions / Profile)
// fit comfortably across the bar without a FAB.

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../theme';

// Indicator: a short pill at the top of the bar that translates between
// tab centers. Width tuned so the indicator lines up with the icon below
// without crowding adjacent tabs.
const INDICATOR_WIDTH = 28;
const INDICATOR_HEIGHT = 3;
const BAR_HEIGHT = 60;
const ICON_SIZE = 23;

const SPRING = { damping: 18, stiffness: 220, mass: 0.55 };

export function TabBar({ state, descriptors, navigation }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const slotWidth = useSharedValue(0);
  const indicatorX = useSharedValue(0);

  // Move the indicator whenever the active route changes. We compute the
  // pixel target inside the effect (slotWidth is a shared value, which is
  // safe to read off-worklet here).
  useEffect(() => {
    if (slotWidth.value <= 0) return;
    const target =
      state.index * slotWidth.value +
      (slotWidth.value - INDICATOR_WIDTH) / 2;
    indicatorX.value = withSpring(target, SPRING);
  }, [state.index, slotWidth, indicatorX]);

  const indicatorStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: indicatorX.value }],
    opacity: slotWidth.value > 0 ? 1 : 0,
  }));

  return (
    <View
      style={{
        backgroundColor: t.colors.card,
        borderTopWidth: 1,
        borderTopColor: t.colors.border,
        paddingBottom: insets.bottom,
        // Soft top-shadow so the bar reads as elevated above content. We
        // only want the shadow above the bar, so offset is negative-Y.
        shadowColor: t.colors.shadow,
        shadowOpacity: t.colors.shadowOpacity * 1.2,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -2 },
        elevation: 10,
      }}
    >
      <View
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          slotWidth.value = w / state.routes.length;
          // First paint: snap the indicator without spring.
          indicatorX.value =
            state.index * (w / state.routes.length) +
            (w / state.routes.length - INDICATOR_WIDTH) / 2;
        }}
        style={{
          flexDirection: 'row',
          height: BAR_HEIGHT,
          alignItems: 'stretch',
        }}
      >
        {/* Top-anchored indicator. Sits 0px from the top so it visually
            attaches to the top edge — like a tab strip indicator. */}
        <Animated.View
          pointerEvents="none"
          style={[
            {
              position: 'absolute',
              top: 0,
              left: 0,
              width: INDICATOR_WIDTH,
              height: INDICATOR_HEIGHT,
              borderBottomLeftRadius: INDICATOR_HEIGHT,
              borderBottomRightRadius: INDICATOR_HEIGHT,
              backgroundColor: t.colors.primary,
            },
            indicatorStyle,
          ]}
        />

        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const isFocused = state.index === index;
          const label =
            options.tabBarLabel !== undefined
              ? options.tabBarLabel
              : options.title !== undefined
              ? options.title
              : route.name;

          const iconForRoute = ICONS[route.name] ?? ['ellipse-outline', 'ellipse'];
          const iconName = isFocused ? iconForRoute[1] : iconForRoute[0];

          return (
            <TabButton
              key={route.key}
              isFocused={isFocused}
              iconName={iconName}
              label={label}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              onPress={() => {
                const event = navigation.emit({
                  type: 'tabPress',
                  target: route.key,
                  canPreventDefault: true,
                });
                if (!isFocused && !event.defaultPrevented) {
                  if (Platform.OS !== 'web') {
                    Haptics.selectionAsync().catch(() => {});
                  }
                  navigation.navigate(route.name);
                }
              }}
              onLongPress={() =>
                navigation.emit({ type: 'tabLongPress', target: route.key })
              }
            />
          );
        })}
      </View>
    </View>
  );
}

// One tab. Pulled out as its own component so each can own its own scale
// shared-value — Reanimated's hook rules forbid useSharedValue inside a
// loop without a stable ordering, and a sub-component is the clean fix.
function TabButton({
  isFocused,
  iconName,
  label,
  onPress,
  onLongPress,
  accessibilityLabel,
}) {
  const t = useTheme();
  const scale = useSharedValue(isFocused ? 1.08 : 1);

  useEffect(() => {
    scale.value = withSpring(isFocused ? 1.08 : 1, SPRING);
  }, [isFocused, scale]);

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={isFocused ? { selected: true } : {}}
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      onLongPress={onLongPress}
      hitSlop={6}
      style={({ pressed }) => [
        {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: 6,
          paddingBottom: 4,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Animated.View style={iconStyle}>
        <Ionicons
          name={iconName}
          size={ICON_SIZE}
          color={isFocused ? t.colors.primary : t.colors.textMuted}
        />
      </Animated.View>
      <Text
        numberOfLines={1}
        style={{
          marginTop: 4,
          color: isFocused ? t.colors.primary : t.colors.textMuted,
          fontSize: 10.5,
          fontFamily: isFocused
            ? t.fontFamily.bodySemibold
            : t.fontFamily.bodyMedium,
          fontWeight: isFocused ? '700' : '500',
          letterSpacing: 0.15,
        }}
      >
        {String(label)}
      </Text>
    </Pressable>
  );
}

const ICONS = {
  index: ['home-outline', 'home'],
  onboard: ['add-circle-outline', 'add-circle'],
  sessions: ['pulse-outline', 'pulse'],
  profile: ['person-outline', 'person'],
};
