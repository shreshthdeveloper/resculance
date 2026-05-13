// Brand mark — uses the same PNG as the web favicon (red triangle with
// broadcast signal). Sized props are passed through to the Image.

import { Image, View } from 'react-native';
import { useTheme } from '../theme';
import { Display, H1, Small } from './Text';

const MARK = require('../../assets/images/resulance-mark.png');

export function LogoMark({ size = 56, style }) {
  return (
    <Image
      source={MARK}
      style={[{ width: size, height: size, resizeMode: 'contain' }, style]}
    />
  );
}

// Stacked: mark over wordmark. Used on splash + login + about.
export function Wordmark({ size = 'large', subtitle }) {
  const t = useTheme();
  const Title = size === 'large' ? Display : H1;
  return (
    <View style={{ alignItems: 'center', gap: t.spacing.s2 }}>
      <Title style={{ letterSpacing: -0.5 }}>Resulance</Title>
      {subtitle ? (
        <View
          style={{
            paddingHorizontal: t.spacing.s3,
            paddingVertical: 3,
            backgroundColor: t.colors.primaryTint,
            borderRadius: t.radius.pill,
          }}
        >
          <Small
            color={t.colors.primary}
            style={{
              fontSize: t.fontSize.xs,
              letterSpacing: 1,
              textTransform: 'uppercase',
              fontWeight: '700',
            }}
          >
            {subtitle}
          </Small>
        </View>
      ) : null}
    </View>
  );
}
