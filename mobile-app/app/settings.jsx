// Settings — theme toggle, account details, link to About.
// (No real "edit profile" yet — the backend has no PATCH /auth/me, just
//  /users/:id and that needs admin scope. Future work.)

import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { errorMessage } from '../src/api/client';
import { getPublicShareConfig, updatePublicShareConfig } from '../src/api/settings';
import { API_URL, SOCKET_URL } from '../src/lib/config';
import { useAuth } from '../src/store/auth';
import { useTheme } from '../src/theme';
import {
  Badge,
  Body,
  BodyStrong,
  Button,
  Card,
  Caption,
  confirm,
  Input,
  OrgPicker,
  Screen,
  SectionHeader,
  ThemeToggle,
  Toggle,
} from '../src/ui';

export default function SettingsScreen() {
  const t = useTheme();
  const user = useAuth((s) => s.user);
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
            <ThemeToggle />
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
              <KV k="Role" v={(user.role ?? 'user').replace('_', ' ')} />
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

        {/* Superadmin: public read-only session sharing config. */}
        {isSuperadmin ? <PublicSharingSection /> : null}

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

        <Button
          label="Sign out"
          variant="danger"
          icon={<Ionicons name="log-out-outline" color="#fff" size={18} />}
          onPress={async () => {
            const ok = await confirm({
              title: 'Sign out',
              message: 'Are you sure you want to sign out?',
              confirmLabel: 'Sign out',
              destructive: true,
              icon: 'log-out-outline',
            });
            if (ok) signOut();
          }}
          fullWidth
          style={{ marginTop: t.spacing.s3 }}
        />
      </ScrollView>
    </Screen>
  );
}

// Public session-sharing config — superadmin only. Mirrors the web's
// Settings → Public Sharing tab: a master enable switch, a require-PIN
// switch, and PIN management. Every change is persisted immediately
// (PUT /settings/public-share) so there's no separate "save" for the toggles.
function PublicSharingSection() {
  const t = useTheme();
  const [config, setConfig] = useState({ enabled: false, requirePin: true, hasPin: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pin, setPin] = useState('');

  useEffect(() => {
    let alive = true;
    getPublicShareConfig()
      .then((c) => alive && setConfig(c))
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const save = async (changes) => {
    try {
      setSaving(true);
      const next = await updatePublicShareConfig(changes);
      setConfig(next);
      if (changes.pin) setPin('');
    } catch (e) {
      Alert.alert('Couldn’t update sharing', errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  // Can't enable (or require a PIN) until a PIN actually exists.
  const enableBlocked = config.requirePin && !config.hasPin && !config.enabled;
  const requirePinBlocked = !config.requirePin && !config.hasPin;

  return (
    <View>
      <SectionHeader title="Public sharing" />
      <Card padding="s4" style={{ gap: t.spacing.s4 }}>
        <Caption>
          Control the read-only public session links. Visitors must enter the access
          PIN to view a shared session.
        </Caption>

        {loading ? (
          <Caption>Loading…</Caption>
        ) : (
          <>
            <ShareRow
              icon="globe-outline"
              title="Enable public sharing"
              subtitle={
                config.enabled
                  ? 'Shared links open a read-only page.'
                  : 'Every shared link is currently blocked.'
              }
            >
              <Toggle
                value={config.enabled}
                disabled={saving || enableBlocked}
                onValueChange={(v) => save({ enabled: v })}
              />
            </ShareRow>

            <View style={{ height: 1, backgroundColor: t.colors.border }} />

            <ShareRow
              icon="lock-closed-outline"
              title="Require access PIN"
              subtitle={
                config.requirePin
                  ? 'Viewers must enter the PIN to open a session.'
                  : 'Anyone with the link can open the session.'
              }
            >
              <Toggle
                value={config.requirePin}
                disabled={saving || requirePinBlocked}
                onValueChange={(v) => save({ requirePin: v })}
              />
            </ShareRow>

            <View style={{ height: 1, backgroundColor: t.colors.border }} />

            {/* PIN management */}
            <View style={{ gap: t.spacing.s2 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
                <BodyStrong style={{ flex: 1 }}>Access PIN</BodyStrong>
                <Badge
                  label={config.hasPin ? 'PIN set' : 'No PIN'}
                  tone={config.hasPin ? 'success' : 'warning'}
                />
              </View>
              <Caption>
                {config.hasPin
                  ? 'Enter a new PIN to replace the current one.'
                  : 'Set a 4–32 character PIN that viewers must enter.'}
              </Caption>
              <Input
                value={pin}
                onChangeText={setPin}
                placeholder="Enter a PIN (4–32 characters)"
                secureTextEntry
                autoCapitalize="none"
                keyboardType="number-pad"
                style={{ marginBottom: 0 }}
              />
              <Button
                label={config.hasPin ? 'Update PIN' : 'Set PIN'}
                size="sm"
                loading={saving}
                disabled={pin.trim().length < 4}
                onPress={() => save({ pin: pin.trim() })}
                icon={<Ionicons name="save-outline" size={16} color="#fff" />}
              />
            </View>
          </>
        )}
      </Card>
    </View>
  );
}

function ShareRow({ icon, title, subtitle, children }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
      <View
        style={{
          width: 38,
          height: 38,
          borderRadius: 19,
          backgroundColor: t.colors.primaryTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={icon} size={19} color={t.colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <BodyStrong>{title}</BodyStrong>
        <Caption style={{ marginTop: 1 }}>{subtitle}</Caption>
      </View>
      {children}
    </View>
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
