// Section header — small uppercase label + optional right-side action.
// Used above grouped lists ("Active sessions", "Crew", etc.).

import { View } from 'react-native';
import { useTheme } from '../theme';
import { Overline } from './Text';

export function SectionHeader({ title, right, style }) {
  const t = useTheme();
  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: t.spacing.s3,
          marginTop: t.spacing.s2,
        },
        style,
      ]}
    >
      <Overline style={{ letterSpacing: 1.2 }}>{title}</Overline>
      {right}
    </View>
  );
}
