// Bottom tab navigator. Four tabs: Home (dashboard), Onboard (patient
// picker), Sessions, Profile. Ambulance + Alerts moved off the bar:
//   - Ambulance is reachable from the Home dashboard's "My ambulance" card.
//   - Alerts is reachable from the top-bar bell — that bell carries the
//     unread badge that used to live on the Alerts tab.
//
// The header on every tab shows: brand mark (left), the screen title
// (center), and the bell (right) so users can jump to /notifications
// from anywhere inside the app.

import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { unreadCount } from '../../src/api/notifications';
import { getSocket } from '../../src/socket/client';
import { useAuth } from '../../src/store/auth';
import { useTheme } from '../../src/theme';
import { LogoMark } from '../../src/ui';
import { TabBar } from '../../src/ui/TabBar';

export default function TabsLayout() {
  const t = useTheme();
  const router = useRouter();
  const status = useAuth((s) => s.status);
  const [unread, setUnread] = useState(0);

  // Keep the unread badge fresh: poll once on mount, then react to live
  // `notification` events from Socket.IO. The badge now sits on the
  // top-bar bell instead of the Alerts tab.
  useEffect(() => {
    if (status !== 'authenticated') return;
    let cancelled = false;
    (async () => {
      try {
        const n = await unreadCount();
        if (!cancelled) setUnread(n);
      } catch {}
    })();
    const sock = getSocket();
    const onNotif = () => setUnread((c) => c + 1);
    sock?.on('notification', onNotif);
    return () => {
      cancelled = true;
      sock?.off('notification', onNotif);
    };
  }, [status]);

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: {
          backgroundColor: t.colors.card,
          borderBottomColor: t.colors.border,
          borderBottomWidth: 1,
        },
        headerTitleStyle: {
          color: t.colors.text,
          fontFamily: t.fontFamily.display,
          fontWeight: '600',
          fontSize: 18,
        },
        headerTitleAlign: 'center',
        headerTintColor: t.colors.primary,
        headerShadowVisible: false,
        headerLeft: () => (
          <View style={{ paddingLeft: t.spacing.s4 }}>
            <LogoMark size={28} />
          </View>
        ),
        headerRight: () => (
          <HeaderBell
            unread={unread}
            onPress={() => router.push('/notifications')}
          />
        ),
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: 'Home', headerTitle: 'Resulance' }}
      />
      <Tabs.Screen
        name="onboard"
        options={{ title: 'Onboard', headerTitle: 'Onboard patient' }}
      />
      <Tabs.Screen
        name="sessions"
        options={{ title: 'Sessions' }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile' }}
      />
    </Tabs>
  );
}

// Top-bar bell with a circular unread badge. Hidden border makes the badge
// sit cleanly over the bell stem instead of cutting into it.
function HeaderBell({ unread, onPress }) {
  const t = useTheme();
  const show = unread > 0;
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel="Notifications"
      style={({ pressed }) => [
        {
          paddingRight: t.spacing.s4,
          paddingLeft: t.spacing.s2,
          paddingVertical: t.spacing.s2,
        },
        pressed && { opacity: 0.7 },
      ]}
    >
      <View>
        <Ionicons name="notifications-outline" size={22} color={t.colors.text} />
        {show ? (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -6,
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              backgroundColor: t.colors.error,
              paddingHorizontal: 3,
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 2,
              borderColor: t.colors.card,
            }}
          >
            <Text
              style={{
                color: '#fff',
                fontSize: 9,
                fontFamily: t.fontFamily.bodyBold,
                fontWeight: '700',
                lineHeight: 11,
              }}
            >
              {unread > 99 ? '99+' : String(unread)}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}
