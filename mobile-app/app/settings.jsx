// Settings — theme toggle, account details, link to About.
// (No real "edit profile" yet — the backend has no PATCH /auth/me, just
//  /users/:id and that needs admin scope. Future work.)

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Alert, ScrollView, View } from 'react-native';
import { API_URL, SOCKET_URL } from '../src/lib/config';
import { useAuth } from '../src/store/auth';
import { useTheme } from '../src/theme';
import {
  Body,
  BodyStrong,
  Button,
  Card,
  Caption,
  OrgPicker,
  Screen,
  SectionHeader,
  Small,
} from '../src/ui';

export default function SettingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const themePreference = useAuth((s) => s.themePreference);
  const setThemePreference = useAuth((s) => s.setThemePreference);
  const signOut = useAuth((s) => s.signOut);
  const isSuperadmin = user?.role === 'superadmin';

  return (
    <Screen edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.s5,
          paddingBottom: t.spacing.s10,
          gap: t.spacing.s4,
        }}
      >
        {/* Appearance */}
        <View>
          <SectionHeader title="Appearance" />
          <Card padding="s4">
            <Body style={{ marginBottom: t.spacing.s3 }}>Theme</Body>
            <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
              {[
                { value: 'system', label: 'Auto', icon: 'phone-portrait-outline' },
                { value: 'light', label: 'Light', icon: 'sunny-outline' },
                { value: 'dark', label: 'Dark', icon: 'moon-outline' },
              ].map((opt) => {
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
                      style={{ marginTop: 6, fontWeight: active ? '700' : '500' }}
                    >
                      {opt.label}
                    </Small>
                  </Card>
                );
              })}
            </View>
            <Caption style={{ marginTop: t.spacing.s3 }}>
              Auto follows your device&apos;s light/dark setting.
            </Caption>
          </Card>
        </View>

        {/* Account */}
        {user ? (
          <View>
            <SectionHeader title="Account" />
            <Card padding="s4">
              <KV k="Name" v={`${user.firstName} ${user.lastName}`} />
              <KV k="Email" v={user.email} />
              <KV k="Username" v={user.username} />
              <KV k="Role" v={user.role.replace('_', ' ')} />
              {user.organization ? (
                <>
                  <KV k="Organization" v={user.organization.name} />
                  <KV k="Org code" v={user.organization.code} />
                </>
              ) : null}
            </Card>
          </View>
        ) : null}

        {/* Superadmin: "viewing as" org persists across screens. */}
        {isSuperadmin ? (
          <View>
            <SectionHeader title="Viewing as" />
            <OrgPicker />
          </View>
        ) : null}

        {/* Connectivity */}
        <View>
          <SectionHeader title="Connectivity" />
          <Card padding="s4">
            <KV k="API endpoint" v={API_URL} />
            <KV k="Socket endpoint" v={SOCKET_URL} />
            <Caption style={{ marginTop: t.spacing.s2 }}>
              These are set via EXPO_PUBLIC_API_URL at build time.
            </Caption>
          </Card>
        </View>

        {/* About */}
        <View>
          <SectionHeader title="About" />
          <Card padding="s4" onPress={() => router.push('/about')}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
              <Ionicons name="information-circle-outline" size={20} color={t.colors.textSecondary} />
              <View style={{ flex: 1 }}>
                <BodyStrong>About Resulance</BodyStrong>
                <Caption>Version, links, credits</Caption>
              </View>
              <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
            </View>
          </Card>
        </View>

        <Button
          label="Sign out"
          variant="danger"
          icon={<Ionicons name="log-out-outline" color="#fff" size={18} />}
          onPress={() =>
            Alert.alert('Sign out', 'Are you sure?', [
              { text: 'Cancel', style: 'cancel' },
              { text: 'Sign out', style: 'destructive', onPress: () => signOut() },
            ])
          }
          fullWidth
          style={{ marginTop: t.spacing.s3 }}
        />
      </ScrollView>
    </Screen>
  );
}

function KV({ k, v }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        paddingVertical: t.spacing.s2,
        gap: t.spacing.s3,
      }}
    >
      <Caption style={{ width: 110 }}>{k}</Caption>
      <Body style={{ flex: 1, textAlign: 'right' }} numberOfLines={2}>
        {v}
      </Body>
    </View>
  );
}
