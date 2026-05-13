// Button — variants from frontend/src/components/ui/Button.jsx:
//   primary  | secondary | outline | danger | success | ghost
// Plus a `loading` state that swaps content for a spinner.

import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { shadow, useTheme } from '../theme';

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  icon,
  fullWidth = false,
  style,
}) {
  const t = useTheme();
  const isDisabled = disabled || loading;
  const v = variantStyles(t.colors)[variant] ?? variantStyles(t.colors).primary;
  const s = sizeStyles(t.spacing, t.fontSize)[size];

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      style={({ pressed }) => [
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          borderRadius: t.radius.xl,
          paddingHorizontal: s.padX,
          paddingVertical: s.padY,
          backgroundColor: v.bg,
          borderWidth: v.borderWidth ?? 0,
          borderColor: v.borderColor,
        },
        variant === 'primary' && !isDisabled && shadow(t.colors, 1),
        fullWidth && { alignSelf: 'stretch' },
        isDisabled && { opacity: 0.5 },
        pressed && !isDisabled && { opacity: 0.85, transform: [{ scale: 0.98 }] },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={v.fg} />
      ) : (
        <>
          {icon ? <View>{icon}</View> : null}
          <Text
            style={{
              color: v.fg,
              fontSize: s.fontSize,
              fontFamily: t.fontFamily.bodySemibold,
              fontWeight: '600',
            }}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

function variantStyles(c) {
  return {
    primary: { bg: c.primary, fg: '#FFFFFF' },
    secondary: {
      bg: c.card,
      fg: c.text,
      borderWidth: 1,
      borderColor: c.border,
    },
    outline: {
      bg: 'transparent',
      fg: c.primary,
      borderWidth: 2,
      borderColor: c.primary,
    },
    danger: { bg: c.error, fg: '#FFFFFF' },
    success: { bg: c.success, fg: '#FFFFFF' },
    ghost: { bg: 'transparent', fg: c.textSecondary },
  };
}

function sizeStyles(spacing, fontSize) {
  return {
    sm: { padX: spacing.s3, padY: spacing.s2, fontSize: fontSize.sm },
    md: { padX: spacing.s4, padY: spacing.s3, fontSize: fontSize.base },
    lg: { padX: spacing.s6, padY: spacing.s4, fontSize: fontSize.lg },
  };
}
