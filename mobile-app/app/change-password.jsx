// Change password — three-field form with light validation. The backend
// validates length and old-password match; we add a confirmation field on
// the client so users can't fat-finger a typo.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';
import { changePassword } from '../src/api/auth';
import { errorMessage } from '../src/api/client';
import { useTheme } from '../src/theme';
import {
  Body,
  Button,
  Card,
  Input,
  Screen,
  Small,
} from '../src/ui';

export default function ChangePasswordScreen() {
  const t = useTheme();
  const router = useRouter();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  // Cheap strength feedback. Backend likely enforces length only — this
  // nudges users toward something stronger.
  const strength = useMemo(() => scorePassword(next), [next]);

  const submit = async () => {
    if (!current || !next || !confirm) {
      Alert.alert('Missing field', 'Please fill all three fields.');
      return;
    }
    if (next.length < 8) {
      Alert.alert('Too short', 'New password must be at least 8 characters.');
      return;
    }
    if (next !== confirm) {
      Alert.alert('Mismatch', 'New password and confirmation do not match.');
      return;
    }
    if (current === next) {
      Alert.alert(
        'Same password',
        'New password must be different from the current one.',
      );
      return;
    }
    setBusy(true);
    try {
      await changePassword(current, next);
      Alert.alert('Updated', 'Your password has been changed.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    } catch (e) {
      Alert.alert('Failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s4 }}>
        <Card padding="s4">
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3, marginBottom: t.spacing.s3 }}>
            <Ionicons name="lock-closed-outline" size={24} color={t.colors.primary} />
            <Body style={{ flex: 1 }}>
              Pick something strong — you’ll be signed out everywhere except this
              session.
            </Body>
          </View>
          <Input
            label="Current password"
            value={current}
            onChangeText={setCurrent}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoComplete="current-password"
          />
          <Input
            label="New password"
            value={next}
            onChangeText={setNext}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoComplete="new-password"
            help={next.length >= 8 ? strength.label : 'At least 8 characters.'}
          />
          <Input
            label="Confirm new password"
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry={!show}
            autoCapitalize="none"
            autoComplete="new-password"
            error={confirm && confirm !== next ? 'Does not match.' : null}
          />

          <Small
            onPress={() => setShow((s) => !s)}
            color={t.colors.primary}
            style={{ fontWeight: '600', marginTop: -t.spacing.s2 }}
          >
            {show ? 'Hide passwords' : 'Show passwords'}
          </Small>
        </Card>

        {next.length >= 8 && (
          <StrengthMeter strength={strength} />
        )}

        <Button label="Update password" loading={busy} onPress={submit} fullWidth />
      </ScrollView>
    </Screen>
  );
}

function StrengthMeter({ strength }) {
  const t = useTheme();
  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          gap: 4,
          marginBottom: 4,
        }}
      >
        {[0, 1, 2, 3].map((i) => (
          <View
            key={i}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              backgroundColor:
                i < strength.score ? strength.color(t.colors) : t.colors.surfaceAlt,
            }}
          />
        ))}
      </View>
      <Small color={strength.color(t.colors)}>{strength.label}</Small>
    </View>
  );
}

function scorePassword(p) {
  let s = 0;
  if (p.length >= 8) s++;
  if (p.length >= 12) s++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) s++;
  if (/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
  const labels = ['Too weak', 'Weak', 'Okay', 'Good', 'Strong'];
  const palette = [
    (c) => c.error,
    (c) => c.error,
    (c) => c.warning,
    (c) => c.info,
    (c) => c.success,
  ];
  return { score: s, label: labels[s], color: palette[s] };
}
