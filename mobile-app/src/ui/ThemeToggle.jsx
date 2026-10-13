// ThemeToggle — Auto / Light / Dark segmented control. Reads & writes the
// persisted `themePreference` on the auth store, so it stays in sync wherever
// it's rendered (Settings + Profile). 'system' follows the device setting.

import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { Card } from './Card';
import { Small } from './Text';

const OPTIONS = [
  { value: 'system', label: 'Auto', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

export function ThemeToggle() {
  const t = useTheme();
  const themePreference = useAuth((s) => s.themePreference);
  const setThemePreference = useAuth((s) => s.setThemePreference);

  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
      {OPTIONS.map((opt) => {
        const active = themePreference === opt.value;
        return (
          <Card
            key={opt.value}
            padding="s3"
            onPress={() => setThemePreference(opt.value)}
            style={[
              { flex: 1, alignItems: 'center' },
              active && {
                borderColor: t.colors.primary,
                borderWidth: 2,
                padding: t.spacing.s3 - 1,
              },
            ]}
          >
            <Ionicons
              name={opt.icon}
              size={22}
              color={active ? t.colors.primary : t.colors.textSecondary}
            />
            <Small
              color={active ? t.colors.primary : t.colors.textSecondary}
              weight={active ? t.fontFamily.bodyBold : t.fontFamily.bodyMedium}
              style={{ marginTop: 6 }}
            >
              {opt.label}
            </Small>
          </Card>
        );
      })}
    </View>
  );
}
