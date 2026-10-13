// Input — matches the frontend's .input class: rounded-2xl, border, teal
// focus ring. Adds an optional label above and an error/help line below.
// Secure (password) fields automatically get a show/hide eye toggle.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useTheme } from '../theme';

export function Input({
  label,
  error,
  help,
  multiline,
  style,
  inputStyle,
  secureTextEntry,
  ...rest
}) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  // Password reveal toggle — only relevant when the field is secure.
  const [revealed, setRevealed] = useState(false);
  const isSecure = !!secureTextEntry;
  const borderColor = error
    ? t.colors.error
    : focused
    ? t.colors.primary
    : t.colors.border;

  return (
    <View style={[{ marginBottom: t.spacing.s4 }, style]}>
      {label ? (
        <Text
          style={{
            color: t.colors.text,
            fontSize: t.fontSize.sm,
            fontFamily: t.fontFamily.bodyMedium,
            fontWeight: '500',
            marginBottom: t.spacing.s2,
          }}
        >
          {label}
        </Text>
      ) : null}
      <View style={{ justifyContent: 'center' }}>
        <TextInput
          {...rest}
          secureTextEntry={isSecure && !revealed}
          multiline={multiline}
          onFocus={(e) => {
            setFocused(true);
            rest.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            rest.onBlur?.(e);
          }}
          placeholderTextColor={t.colors.textMuted}
          style={[
            {
              backgroundColor: t.colors.card,
              color: t.colors.text,
              borderColor,
              borderWidth: focused ? 2 : 1,
              borderRadius: t.radius.xl,
              paddingHorizontal: t.spacing.s4,
              // Reserve room on the right for the eye toggle so the text
              // doesn't run underneath it.
              paddingRight: isSecure ? t.spacing.s10 : t.spacing.s4,
              // 2px focus border eats vertical padding — compensate so the
              // field's height doesn't visibly jump on focus.
              paddingVertical: focused ? t.spacing.s3 - 1 : t.spacing.s3,
              fontSize: t.fontSize.base,
              fontFamily: t.fontFamily.body,
              minHeight: multiline ? 88 : undefined,
              textAlignVertical: multiline ? 'top' : 'auto',
            },
            inputStyle,
          ]}
        />
        {isSecure ? (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            style={({ pressed }) => [
              {
                position: 'absolute',
                right: t.spacing.s3,
                height: '100%',
                justifyContent: 'center',
                paddingHorizontal: 4,
              },
              pressed && { opacity: 0.6 },
            ]}
          >
            <Ionicons
              name={revealed ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={t.colors.textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {(error || help) && (
        <Text
          style={{
            color: error ? t.colors.error : t.colors.textSecondary,
            fontSize: t.fontSize.xs,
            fontFamily: t.fontFamily.body,
            marginTop: t.spacing.s1,
          }}
        >
          {error || help}
        </Text>
      )}
    </View>
  );
}
