// Bottom tab navigator. Five tabs: Home (dashboard), My ambulance, Sessions,
// Alerts, Profile. Theme-aware so it works under light + dark mode.

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { unreadCount } from '../../src/api/notifications';
import { getSocket } from '../../src/socket/client';
import { useAuth } from '../../src/store/auth';
import { useTheme } from '../../src/theme';

export default function TabsLayout() {
  const t = useTheme();
  const status = useAuth((s) => s.status);
  const [unread, setUnread] = useState(0);

  // Keep the unread badge fresh: poll once on mount, then react to live
  // `notification` events from Socket.IO.
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
      screenOptions={{
        tabBarActiveTintColor: t.colors.primary,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarStyle: {
          backgroundColor: t.colors.card,
          borderTopColor: t.colors.border,
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 86 : 64,
          paddingTop: 8,
          paddingBottom: Platform.OS === 'ios' ? 28 : 8,
        },
        tabBarLabelStyle: {
          fontFamily: t.fontFamily.bodyMedium,
          fontSize: 11,
          fontWeight: '500',
          marginTop: 2,
        },
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
        headerTintColor: t.colors.primary,
        headerShadowVisible: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          headerTitle: 'Resulance',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="ambulance"
        options={{
          title: 'My ambulance',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'car-sport' : 'car-sport-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tabs.Screen
        name="sessions"
        options={{
          title: 'Sessions',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons name={focused ? 'pulse' : 'pulse-outline'} color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          title: 'Alerts',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'notifications' : 'notifications-outline'}
              color={color}
              size={size}
            />
          ),
          tabBarBadge: unread > 0 ? unread : undefined,
          tabBarBadgeStyle: {
            backgroundColor: t.colors.error,
            color: '#FFFFFF',
            fontSize: 10,
            fontWeight: '700',
          },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, size, focused }) => (
            <Ionicons
              name={focused ? 'person-circle' : 'person-circle-outline'}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tabs>
  );
}
