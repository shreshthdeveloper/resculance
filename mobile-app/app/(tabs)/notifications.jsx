// Notifications tab — list + live-prepended socket events. Tap to mark
// read; "mark all read" in the header.

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import { errorMessage } from '../../src/api/client';
import {
  listNotifications,
  markAllRead,
  markRead,
} from '../../src/api/notifications';
import { getSocket } from '../../src/socket/client';
import { useTheme } from '../../src/theme';
import {
  Body,
  BodyStrong,
  Card,
  Caption,
  EmptyState,
  Screen,
  Small,
} from '../../src/ui';

export default function NotificationsScreen() {
  const t = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const n = await listNotifications(100);
      setItems(n);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Live-prepend incoming notifications. We use a monotonic counter for
  // synthetic ids — `Date.now()` alone collides if two events arrive in
  // the same millisecond.
  useEffect(() => {
    const sock = getSocket();
    if (!sock) return;
    let seq = 0;
    const handler = (n) => {
      seq += 1;
      setItems((prev) => [
        {
          _id: `live-${Date.now()}-${seq}`,
          user_id: '',
          type: n.type,
          title: n.title,
          message: n.message,
          data: n.data ?? null,
          is_read: false,
          read_at: null,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ]);
    };
    sock.on('notification', handler);
    return () => {
      sock.off('notification', handler);
    };
  }, []);

  const onTap = async (n) => {
    if (n.is_read) return;
    setItems((p) => p.map((x) => (x._id === n._id ? { ...x, is_read: true } : x)));
    try {
      await markRead(n._id);
    } catch {}
  };

  const onMarkAll = async () => {
    setItems((p) => p.map((x) => ({ ...x, is_read: true })));
    try {
      await markAllRead();
    } catch {}
  };

  const unread = items.filter((n) => !n.is_read).length;

  return (
    <Screen>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: t.spacing.s5,
          paddingBottom: t.spacing.s3,
        }}
      >
        <Small>
          {unread > 0
            ? `${unread} unread · ${items.length} total`
            : items.length > 0
            ? `${items.length} total`
            : ''}
        </Small>
        {unread > 0 && (
          <Pressable onPress={onMarkAll} hitSlop={8}>
            <Small color={t.colors.primary} style={{ fontWeight: '600' }}>
              Mark all read
            </Small>
          </Pressable>
        )}
      </View>
      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.colors.primary} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{
            padding: t.spacing.s5,
            paddingTop: 0,
            gap: t.spacing.s3,
          }}
          data={items}
          keyExtractor={(n) => n._id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load();
              }}
              tintColor={t.colors.primary}
              colors={[t.colors.primary]}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="notifications-off-outline"
              title="No alerts"
              subtitle={err ?? 'You are all caught up. New alerts will appear here in real time.'}
            />
          }
          renderItem={({ item }) => <NotifRow item={item} onPress={() => onTap(item)} />}
        />
      )}
    </Screen>
  );
}

function NotifRow({ item, onPress }) {
  const t = useTheme();
  const tone = pickTone(item.type);
  return (
    <Card
      onPress={onPress}
      padding="s4"
      // Keep border at 1px so layout doesn't shift between read/unread;
      // just swap the colour for unread.
      style={!item.is_read ? { borderColor: t.colors.primary } : null}
    >
      <View style={{ flexDirection: 'row', gap: t.spacing.s3 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: t.colors[`${tone}Tint`] ?? t.colors.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={iconFor(item.type)}
            size={18}
            color={t.colors[tone] ?? t.colors.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'baseline',
              gap: t.spacing.s2,
            }}
          >
            <BodyStrong style={{ flex: 1 }} numberOfLines={1}>
              {item.title}
            </BodyStrong>
            <Caption>
              {new Date(item.created_at).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </Caption>
          </View>
          <Body color={t.colors.textSecondary} style={{ marginTop: 2 }}>
            {item.message}
          </Body>
        </View>
        {!item.is_read && (
          <View
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: t.colors.primary,
              marginTop: 6,
            }}
          />
        )}
      </View>
    </Card>
  );
}

function pickTone(type) {
  if (!type) return 'primary';
  const s = type.toLowerCase();
  if (s.includes('emergency') || s.includes('error') || s.includes('rejected')) return 'danger';
  if (s.includes('warning') || s.includes('pending')) return 'warning';
  if (s.includes('success') || s.includes('approved') || s.includes('complete')) return 'success';
  return 'primary';
}

function iconFor(type) {
  if (!type) return 'notifications';
  const s = type.toLowerCase();
  if (s.includes('emergency')) return 'warning';
  if (s.includes('message')) return 'chatbubble';
  if (s.includes('session') || s.includes('onboard')) return 'pulse';
  if (s.includes('collab') || s.includes('partner')) return 'git-network';
  if (s.includes('user')) return 'person';
  return 'notifications';
}
