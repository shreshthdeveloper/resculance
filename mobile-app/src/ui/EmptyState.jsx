// EmptyState — the friendly "nothing here yet" panel. Mirrors the empty
// states the frontend uses (icon + heading + subtitle + optional action).

import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';
import { Body, H3 } from './Text';

export function EmptyState({ icon = 'cloud-offline-outline', title, subtitle, action }) {
  const t = useTheme();
  return (
    <View
      style={{
        alignItems: 'center',
        justifyContent: 'center',
        padding: t.spacing.s8,
        gap: t.spacing.s3,
      }}
    >
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 32,
          backgroundColor: t.colors.surfaceAlt,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: t.spacing.s2,
        }}
      >
        <Ionicons name={icon} size={28} color={t.colors.textMuted} />
      </View>
      {title ? <H3 style={{ textAlign: 'center' }}>{title}</H3> : null}
      {subtitle ? (
        <Body color={t.colors.textSecondary} style={{ textAlign: 'center', maxWidth: 280 }}>
          {subtitle}
        </Body>
      ) : null}
      {action ? <View style={{ marginTop: t.spacing.s3 }}>{action}</View> : null}
    </View>
  );
}
