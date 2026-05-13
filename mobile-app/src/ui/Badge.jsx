// Badge / Pill — for statuses (available, in_transit, etc.) and role tags.
// Tone maps to a tinted background + matching foreground.

import { Text, View } from 'react-native';
import { useTheme } from '../theme';

export function Badge({ label, tone = 'neutral', dot = false, style }) {
  const t = useTheme();
  const map = {
    neutral: { bg: t.colors.surfaceAlt, fg: t.colors.textSecondary },
    primary: { bg: t.colors.primaryTint, fg: t.colors.primary },
    success: { bg: t.colors.successTint, fg: t.colors.success },
    warning: { bg: t.colors.warningTint, fg: t.colors.warning },
    danger: { bg: t.colors.errorTint, fg: t.colors.error },
    info: { bg: t.colors.infoTint, fg: t.colors.info },
  };
  const c = map[tone] ?? map.neutral;

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
          backgroundColor: c.bg,
          paddingHorizontal: t.spacing.s3,
          paddingVertical: 4,
          borderRadius: t.radius.pill,
          alignSelf: 'flex-start',
        },
        style,
      ]}
    >
      {dot && (
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: c.fg,
          }}
        />
      )}
      <Text
        style={{
          color: c.fg,
          fontSize: t.fontSize.xs,
          fontFamily: t.fontFamily.bodySemibold,
          fontWeight: '600',
          textTransform: 'uppercase',
          letterSpacing: 0.4,
        }}
      >
        {label}
      </Text>
    </View>
  );
}

// Pick a tone for a session/ambulance status string.
export function toneForStatus(status) {
  switch (status) {
    case 'available':
    case 'active':
    case 'approved':
      return 'success';
    case 'onboarded':
    case 'in_transit':
    case 'pending':
    case 'pending_approval':
      return 'warning';
    case 'offboarded':
    case 'completed':
      return 'primary';
    case 'cancelled':
    case 'rejected':
    case 'inactive':
    case 'maintenance':
      return 'danger';
    default:
      return 'neutral';
  }
}
