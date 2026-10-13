// Toggle — an animated iOS-style switch. Matches the web's role="switch"
// pills (h-7 w-12, primary when on). Built on Animated so the knob slides
// instead of snapping, and dims while a save is in flight.

import { useEffect, useRef } from 'react';
import { Animated, Pressable } from 'react-native';
import { useTheme } from '../theme';

const TRACK_W = 48;
const TRACK_H = 28;
const KNOB = 22;
const PAD = 3;

export function Toggle({ value, onValueChange, disabled = false }) {
  const t = useTheme();
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [t.colors.surfaceAlt, t.colors.primary],
  });
  const knobX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [PAD, TRACK_W - KNOB - PAD],
  });

  return (
    <Pressable
      role="switch"
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => onValueChange?.(!value)}
      style={{ opacity: disabled ? 0.45 : 1 }}
    >
      <Animated.View
        style={{
          width: TRACK_W,
          height: TRACK_H,
          borderRadius: TRACK_H / 2,
          backgroundColor: trackColor,
          justifyContent: 'center',
        }}
      >
        <Animated.View
          style={{
            width: KNOB,
            height: KNOB,
            borderRadius: KNOB / 2,
            backgroundColor: '#FFFFFF',
            transform: [{ translateX: knobX }],
            shadowColor: '#000',
            shadowOpacity: 0.2,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
            elevation: 2,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}
