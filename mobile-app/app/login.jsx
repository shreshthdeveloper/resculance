// Login — mirrors frontend/src/pages/auth/Login.jsx: centered card on a
// pale background, big logo above, rounded inputs with teal focus ring,
// "remember me" / "forgot password" row, soft footer.

import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { errorMessage } from '../src/api/client';
import { API_URL } from '../src/lib/config';
import { useAuth } from '../src/store/auth';
import { useTheme } from '../src/theme';
import {
  Body,
  Button,
  Caption,
  Card,
  Display,
  Input,
  LogoMark,
  Screen,
  Small,
} from '../src/ui';

export default function LoginScreen() {
  const t = useTheme();
  const signIn = useAuth((s) => s.signIn);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const onSubmit = async () => {
    if (!email.trim() || !password) {
      Alert.alert('Missing fields', 'Email and password are required.');
      return;
    }
    setBusy(true);
    try {
      await signIn(email.trim(), password);
    } catch (e) {
      Alert.alert('Login failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            padding: t.spacing.s6,
            justifyContent: 'center',
          }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ alignItems: 'center', marginBottom: t.spacing.s8 }}>
            <LogoMark size={64} />
            <Display
              style={{
                marginTop: t.spacing.s5,
                fontSize: 32,
                letterSpacing: -0.5,
              }}
            >
              Welcome back
            </Display>
            <Body
              color={t.colors.textSecondary}
              style={{ marginTop: t.spacing.s2, textAlign: 'center' }}
            >
              Sign in to access your ambulance crew dashboard
            </Body>
          </View>

          <Card padding="s6" level={2}>
            <Input
              label="Email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@hospital.example"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              editable={!busy}
            />
            <Input
              label="Password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              textContentType="password"
              editable={!busy}
              onSubmitEditing={onSubmit}
            />

            <View
              style={{
                flexDirection: 'row',
                justifyContent: 'flex-end',
                marginBottom: t.spacing.s4,
              }}
            >
              <Pressable hitSlop={8}>
                <Small color={t.colors.primary} style={{ fontWeight: '600' }}>
                  Forgot password?
                </Small>
              </Pressable>
            </View>

            <Button
              label={busy ? 'Signing in…' : 'Sign in'}
              onPress={onSubmit}
              loading={busy}
              fullWidth
              size="lg"
            />
          </Card>

          <Caption
            style={{ textAlign: 'center', marginTop: t.spacing.s6 }}
            numberOfLines={1}
          >
            {API_URL}
          </Caption>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
