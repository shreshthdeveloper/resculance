// Card — frontend's .card class (rounded-2xl, p-6, shadow-soft on white).
// Press handler is optional; with one it becomes a TouchableOpacity that
// reacts on press with a subtle scale-down (matches web's active:scale-[0.98]).

import { Pressable, View } from 'react-native';
import { shadow, useTheme } from '../theme';

export function Card({ children, onPress, padding = 's6', style, level = 1 }) {
  const t = useTheme();
  const base = {
    backgroundColor: t.colors.card,
    borderRadius: t.radius.xl,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: t.spacing[padding] ?? t.spacing.s6,
    ...shadow(t.colors, level),
  };

  if (!onPress) {
    return <View style={[base, style]}>{children}</View>;
  }
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        base,
        pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
        style,
      ]}
    >
      {children}
    </Pressable>
  );
}
