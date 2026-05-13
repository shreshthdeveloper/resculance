// About — version, license, links.

import { Ionicons } from '@expo/vector-icons';
import { Linking, Pressable, ScrollView, View } from 'react-native';
import { useTheme } from '../src/theme';
import {
  Body,
  BodyStrong,
  Caption,
  Card,
  Display,
  LogoMark,
  Screen,
  SectionHeader,
  Small,
} from '../src/ui';

export default function AboutScreen() {
  const t = useTheme();
  return (
    <Screen edges={['bottom']}>
      <ScrollView
        contentContainerStyle={{
          padding: t.spacing.s5,
          gap: t.spacing.s4,
          alignItems: 'center',
        }}
      >
        <View style={{ alignItems: 'center', paddingVertical: t.spacing.s6 }}>
          <LogoMark size={80} />
          <Display style={{ marginTop: t.spacing.s4, fontSize: 32 }}>Resulance</Display>
          <Caption style={{ marginTop: 4 }}>Smart Ambulance Platform</Caption>
          <Caption style={{ marginTop: t.spacing.s3 }}>Version 1.0.0</Caption>
        </View>

        <Card padding="s5" style={{ alignSelf: 'stretch' }}>
          <SectionHeader title="What this app does" />
          <Body color={t.colors.textSecondary}>
            Resulance Mobile is the paramedic companion to the Resulance backend.
            Sign in, view your assigned ambulance, onboard patients, record vital
            signs, chat with the crew in real time, and offboard sessions on arrival.
          </Body>
        </Card>

        <Card padding="s5" style={{ alignSelf: 'stretch' }}>
          <SectionHeader title="Built with" />
          <Row icon="logo-react" label="React Native" sub="0.81" />
          <Row icon="rocket-outline" label="Expo SDK 54" sub="expo-router 6" />
          <Row icon="cloud-outline" label="Resulance backend" sub="REST + Socket.IO" />
        </Card>

        <Card padding="s5" style={{ alignSelf: 'stretch' }}>
          <SectionHeader title="Links" />
          <LinkRow
            icon="document-text-outline"
            label="Source on GitHub"
            onPress={() => Linking.openURL('https://github.com/').catch(() => {})}
          />
          <LinkRow
            icon="shield-checkmark-outline"
            label="Privacy policy"
            onPress={() => Linking.openURL('https://example.com/privacy').catch(() => {})}
          />
          <LinkRow
            icon="reader-outline"
            label="Terms of service"
            onPress={() => Linking.openURL('https://example.com/terms').catch(() => {})}
          />
        </Card>

        <Small color={t.colors.textMuted} style={{ textAlign: 'center', marginTop: t.spacing.s5 }}>
          © {new Date().getFullYear()} Resulance Team
        </Small>
      </ScrollView>
    </Screen>
  );
}

function Row({ icon, label, sub }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.s3,
        paddingVertical: t.spacing.s2,
      }}
    >
      <Ionicons name={icon} size={18} color={t.colors.textSecondary} />
      <View style={{ flex: 1 }}>
        <BodyStrong>{label}</BodyStrong>
        {sub ? <Caption>{sub}</Caption> : null}
      </View>
    </View>
  );
}

function LinkRow({ icon, label, onPress }) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={6}>
      {({ pressed }) => (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s3,
            paddingVertical: t.spacing.s3,
            opacity: pressed ? 0.55 : 1,
          }}
        >
          <Ionicons name={icon} size={18} color={t.colors.primary} />
          <Body color={t.colors.primary} style={{ flex: 1, fontWeight: '600' }}>
            {label}
          </Body>
          <Ionicons name="open-outline" size={16} color={t.colors.primary} />
        </View>
      )}
    </Pressable>
  );
}
