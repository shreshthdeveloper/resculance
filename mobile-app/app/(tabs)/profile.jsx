// Profile tab — user identity card, list of account / org actions, and a
// danger sign-out. Hospital + fleet admins/staff get the Partnerships row.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, Image, Linking, Pressable, ScrollView, View } from 'react-native';
import { getManageTiles } from '../../src/lib/permissions';
import { useAuth } from '../../src/store/auth';
import { useTheme } from '../../src/theme';
import {
  Badge,
  BodyStrong,
  Button,
  Card,
  Caption,
  Screen,
  SectionHeader,
  Small,
} from '../../src/ui';

export default function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const signOut = useAuth((s) => s.signOut);
  const manageTiles = getManageTiles(user?.role);

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
          paddingBottom: t.spacing.s12,
          gap: t.spacing.s4,
        }}
      >
        {/* Identity card */}
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
                overflow: 'hidden',
                shadowColor: t.colors.primary,
                shadowOpacity: 0.3,
                shadowRadius: 12,
                shadowOffset: { width: 0, height: 6 },
                elevation: 6,
              }}
            >
              {user.profileImageUrl ? (
                <Image
                  source={{ uri: user.profileImageUrl }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <BodyStrong color="#fff" style={{ fontSize: 30, fontWeight: '700' }}>
                  {initials}
                </BodyStrong>
              )}
            </View>
            <BodyStrong style={{ fontSize: 20 }}>
              {user.firstName} {user.lastName}
            </BodyStrong>
            <Small style={{ marginTop: 2 }}>{user.email}</Small>
            <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s3, flexWrap: 'wrap', justifyContent: 'center' }}>
              <Badge label={(user.role ?? 'user').replace('_', ' ')} tone="primary" />
              {user.organization ? (
                <Badge label={user.organization.type?.replace('_', ' ') ?? 'org'} tone="neutral" />
              ) : null}
            </View>
            <Pressable onPress={() => router.push('/edit-profile')} hitSlop={6}>
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                  marginTop: t.spacing.s4,
                  paddingHorizontal: t.spacing.s4,
                  paddingVertical: t.spacing.s2,
                  borderRadius: t.radius.pill,
                  backgroundColor: t.colors.primaryTint,
                }}
              >
                <Ionicons name="create-outline" size={16} color={t.colors.primary} />
                <Small color={t.colors.primary} style={{ fontWeight: '600' }}>
                  Edit profile
                </Small>
              </View>
            </Pressable>
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

        {/* Manage section. Sourced from src/lib/permissions.js so each
            role sees exactly what the web sidebar would show. */}
        {manageTiles.length > 0 ? (
          <View>
            <SectionHeader title="Manage" />
            <View style={{ gap: t.spacing.s2 }}>
              {manageTiles.map((tile) => (
                <ListRow
                  key={tile.key}
                  icon={`${tile.icon}-outline`}
                  label={tile.label}
                  sub={tile.sub}
                  onPress={() => router.push(tile.route)}
                />
              ))}
            </View>
          </View>
        ) : null}

        {/* Account section */}
        <View>
          <SectionHeader title="Account" />
          <View style={{ gap: t.spacing.s2 }}>
            <ListRow
              icon="lock-closed-outline"
              label="Change password"
              sub="Update your sign-in password"
              onPress={() => router.push('/change-password')}
            />
            <ListRow
              icon="settings-outline"
              label="Settings"
              sub="Theme, connectivity, account"
              onPress={() => router.push('/settings')}
            />
          </View>
        </View>

        {/* App section */}
        <View>
          <SectionHeader title="App" />
          <View style={{ gap: t.spacing.s2 }}>
            <ListRow
              icon="information-circle-outline"
              label="About"
              sub="Version, links, credits"
              onPress={() => router.push('/about')}
            />
            <ListRow
              icon="help-circle-outline"
              label="Help & support"
              sub="Email us at distrx.io@gmail.com"
              onPress={() =>
                Linking.openURL('mailto:distrx.io@gmail.com?subject=resculance%20help').catch(() =>
                  Alert.alert('Help', 'Email distrx.io@gmail.com for support.'),
                )
              }
            />
          </View>
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
          resculance Mobile v1.0.0
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
        <Card padding="s4" style={pressed ? { opacity: 0.85 } : null}>
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
