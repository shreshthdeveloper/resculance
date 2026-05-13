// Profile — user identity card on top, then a list of "settings"-style rows
// for navigation (Settings, About) and a sign-out at the bottom.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { useAuth } from '../../src/store/auth';
import { useTheme } from '../../src/theme';
import {
  Badge,
  BodyStrong,
  Button,
  Card,
  Caption,
  Screen,
  Small,
} from '../../src/ui';

export default function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);

  const onSignOut = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
    ]);
  };

  if (!user) return null;

  const initials = `${user.firstName?.[0] ?? '?'}${user.lastName?.[0] ?? ''}`.toUpperCase();

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.s5,
          paddingBottom: t.spacing.s10,
          gap: t.spacing.s4,
        }}
      >
        {/* Identity */}
        <Card padding="s6" level={2}>
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                width: 88,
                height: 88,
                borderRadius: 44,
                backgroundColor: t.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: t.spacing.s4,
                shadowColor: t.colors.primary,
                shadowOpacity: 0.3,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              }}
            >
              <BodyStrong color="#fff" style={{ fontSize: 30, fontWeight: '700' }}>
                {initials}
              </BodyStrong>
            </View>
            <BodyStrong style={{ fontSize: 20 }}>
              {user.firstName} {user.lastName}
            </BodyStrong>
            <Small style={{ marginTop: 2 }}>{user.email}</Small>
            <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s3 }}>
              <Badge label={user.role.replace('_', ' ')} tone="primary" />
              {user.organization ? (
                <Badge label={user.organization.type} tone="neutral" />
              ) : null}
            </View>
          </View>
        </Card>

        {/* Organization */}
        {user.organization ? (
          <Card padding="s4">
            <Caption style={{ marginBottom: t.spacing.s2 }}>Organization</Caption>
            <BodyStrong>{user.organization.name}</BodyStrong>
            <Small>{user.organization.code}</Small>
          </Card>
        ) : null}

        {/* Settings list */}
        <View style={{ gap: t.spacing.s2 }}>
          <ListRow
            icon="settings-outline"
            label="Settings"
            sub="Theme, notifications, account"
            onPress={() => router.push('/settings')}
          />
          <ListRow
            icon="information-circle-outline"
            label="About"
            sub="Version, links, credits"
            onPress={() => router.push('/about')}
          />
          <ListRow
            icon="help-circle-outline"
            label="Help & support"
            sub="Get in touch with your administrator"
            onPress={() => Alert.alert('Help', 'Contact your organization admin for help.')}
          />
        </View>

        <Button
          label="Sign out"
          variant="danger"
          onPress={onSignOut}
          icon={<Ionicons name="log-out-outline" size={18} color="#fff" />}
          fullWidth
          style={{ marginTop: t.spacing.s4 }}
        />

        <Caption style={{ textAlign: 'center', marginTop: t.spacing.s4 }}>
          Resulance Mobile v1.0.0
        </Caption>
      </ScrollView>
    </Screen>
  );
}

function ListRow({ icon, label, sub, onPress }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress}>
      {({ pressed }) => (
        <Card
          padding="s4"
          style={pressed ? { opacity: 0.85 } : null}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
            <View
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                backgroundColor: t.colors.surfaceAlt,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name={icon} size={18} color={t.colors.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <BodyStrong>{label}</BodyStrong>
              {sub ? <Small>{sub}</Small> : null}
            </View>
            <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
          </View>
        </Card>
      )}
    </Pressable>
  );
}
