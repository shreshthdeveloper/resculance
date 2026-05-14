// Themed text components. Using a small set of named variants keeps the
// type scale consistent across screens — same idea as the web's Tailwind
// `text-2xl font-bold` patterns.

import { Text as RNText } from 'react-native';
import { useTheme } from '../theme';

function makeText(variant) {
  return function ThemedText({ style, color, weight, children, ...rest }) {
    const t = useTheme();
    const v = variants(t)[variant];
    return (
      <RNText
        {...rest}
        style={[
          {
            color: color ?? v.color,
            fontSize: v.size,
            fontFamily: weight ?? v.fontFamily,
            fontWeight: v.fontWeight,
            lineHeight: v.lineHeight,
          },
          style,
        ]}
      >
        {children}
      </RNText>
    );
  };
}

function variants(t) {
  return {
    display: {
      color: t.colors.text,
      size: t.fontSize.display,
      fontFamily: t.fontFamily.displayBold,
      fontWeight: '700',
      lineHeight: t.fontSize.display * 1.15,
    },
    h1: {
      color: t.colors.text,
      size: t.fontSize.xxl,
      fontFamily: t.fontFamily.displayBold,
      fontWeight: '700',
      lineHeight: t.fontSize.xxl * 1.2,
    },
    h2: {
      color: t.colors.text,
      size: t.fontSize.xl,
      fontFamily: t.fontFamily.display,
      fontWeight: '600',
      // Tightened from 1.25 → 1.2 so section headers don't dominate cards.
      lineHeight: t.fontSize.xl * 1.2,
    },
    h3: {
      color: t.colors.text,
      size: t.fontSize.lg,
      fontFamily: t.fontFamily.bodySemibold,
      fontWeight: '600',
      // Tightened from 1.3 → 1.2 for the same reason.
      lineHeight: t.fontSize.lg * 1.2,
    },
    body: {
      color: t.colors.text,
      size: t.fontSize.base,
      fontFamily: t.fontFamily.body,
      fontWeight: '400',
      lineHeight: t.fontSize.base * 1.45,
    },
    bodyStrong: {
      color: t.colors.text,
      size: t.fontSize.base,
      fontFamily: t.fontFamily.bodySemibold,
      fontWeight: '600',
      lineHeight: t.fontSize.base * 1.45,
    },
    small: {
      color: t.colors.textSecondary,
      size: t.fontSize.sm,
      fontFamily: t.fontFamily.body,
      fontWeight: '400',
      lineHeight: t.fontSize.sm * 1.4,
    },
    caption: {
      color: t.colors.textMuted,
      size: t.fontSize.xs,
      fontFamily: t.fontFamily.bodyMedium,
      fontWeight: '500',
      lineHeight: t.fontSize.xs * 1.4,
    },
    overline: {
      color: t.colors.textSecondary,
      size: t.fontSize.xs,
      fontFamily: t.fontFamily.bodySemibold,
      fontWeight: '600',
      lineHeight: t.fontSize.xs * 1.4,
    },
  };
}

export const Display = makeText('display');
export const H1 = makeText('h1');
export const H2 = makeText('h2');
export const H3 = makeText('h3');
export const Body = makeText('body');
export const BodyStrong = makeText('bodyStrong');
export const Small = makeText('small');
export const Caption = makeText('caption');
export const Overline = makeText('overline');
