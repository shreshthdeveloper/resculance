// Activity logs. Mirrors the web /activity page: paginated list of audit
// entries, filterable by user, type, and search. Superadmin-only on the
// backend (or anyone with VIEW_ACTIVITY_LOGS, currently superadmin).

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import {
  listActivities,
  listActivityTypes,
  listActivityUsers,
} from '../src/api/activity';
import { errorMessage } from '../src/api/client';
import { PERMISSIONS, hasPermission } from '../src/lib/permissions';
import { useAuth } from '../src/store/auth';
import { useTheme } from '../src/theme';
import {
  Body,
  BodyStrong,
  Card,
  Caption,
  EmptyState,
  Screen,
  SkeletonRow,
  Small,
} from '../src/ui';

export default function ActivityScreen() {
  const t = useTheme();
  const me = useAuth((s) => s.user);
  const canView = hasPermission(me?.role, PERMISSIONS.VIEW_ACTIVITY_LOGS);

  const [items, setItems] = useState([]);
  const [types, setTypes] = useState([]);
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [userFilter, setUserFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const load = useCallback(async () => {
    setErr(null);
    if (!canView) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const params = { limit: 100 };
      if (q) params.search = q;
      if (typeFilter) params.type = typeFilter;
      if (userFilter) params.userId = userFilter;
      const r = await listActivities(params);
      setItems(r.activities ?? r.logs ?? []);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [q, typeFilter, userFilter, canView]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!canView) return;
    // Fetch filter options once.
    listActivityTypes().then(setTypes).catch(() => {});
    listActivityUsers().then(setUsers).catch(() => {});
  }, [canView]);

  useEffect(() => {
    const id = setTimeout(() => load(), 300);
    return () => clearTimeout(id);
  }, [q, load]);

  if (!canView) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="lock-closed-outline"
          title="Superadmin only"
          subtitle="Activity logs are restricted to system administrators."
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <View style={{ padding: t.spacing.s5, paddingBottom: t.spacing.s3, gap: t.spacing.s3 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.s2,
            backgroundColor: t.colors.card,
            borderRadius: t.radius.xl,
            borderWidth: 1,
            borderColor: t.colors.border,
            paddingHorizontal: t.spacing.s4,
          }}
        >
          <Ionicons name="search" size={18} color={t.colors.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search description / action…"
            placeholderTextColor={t.colors.textMuted}
            autoCorrect={false}
            style={{
              flex: 1,
              color: t.colors.text,
              fontFamily: t.fontFamily.body,
              fontSize: t.fontSize.base,
              paddingVertical: t.spacing.s3,
            }}
          />
          {q ? (
            <Pressable onPress={() => setQ('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color={t.colors.textMuted} />
            </Pressable>
          ) : null}
        </View>

        {types.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
              <Pill label="All types" active={typeFilter === ''} onPress={() => setTypeFilter('')} />
              {types.map((tp) => (
                <Pill
                  key={tp}
                  label={String(tp).replace('_', ' ')}
                  active={typeFilter === tp}
                  onPress={() => setTypeFilter(tp)}
                />
              ))}
            </View>
          </ScrollView>
        ) : null}

        {users.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
              <Pill label="All users" active={userFilter === ''} onPress={() => setUserFilter('')} />
              {users.slice(0, 30).map((u) => (
                <Pill
                  key={u.id}
                  label={`${u.firstName ?? ''} ${u.lastName ?? ''}`.trim() || u.email || u.id}
                  active={String(userFilter) === String(u.id)}
                  onPress={() => setUserFilter(u.id)}
                />
              ))}
            </View>
          </ScrollView>
        ) : null}
      </View>

      <FlatList
        contentContainerStyle={{
          paddingHorizontal: t.spacing.s5,
          paddingBottom: t.spacing.s12,
          gap: t.spacing.s3,
        }}
        data={loading ? [] : items}
        keyExtractor={(a) => String(a.id ?? a._id)}
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
          loading ? (
            <View style={{ gap: t.spacing.s3 }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : (
            <EmptyState
              icon="reader-outline"
              title="No activity"
              subtitle={err ?? 'No activity matches the current filters.'}
            />
          )
        }
        renderItem={({ item }) => <ActivityRow log={item} />}
      />
    </Screen>
  );
}

function Pill({ label, active, onPress }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: t.spacing.s4,
          paddingVertical: t.spacing.s2,
          borderRadius: t.radius.pill,
          backgroundColor: active ? t.colors.primary : t.colors.surfaceAlt,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Small color={active ? '#fff' : t.colors.textSecondary} style={{ fontWeight: '600' }}>
        {label}
      </Small>
    </Pressable>
  );
}

function ActivityRow({ log }) {
  const t = useTheme();
  // Backend ActivityLog schema (Mongo): { activity, comments, user_name,
  // organization_name, metadata, created_at }. The pre-Mongo backend used
  // different field names so the original fallback chain (`action`,
  // `activity_type`, `type`, `description`, `message`, `summary`) never
  // resolved against the new shape — every row rendered as "event" with no
  // description. Put the real field names (`activity`, `comments`) at the
  // front; keep the legacy ones as defensive fallbacks.
  const action = log.activity ?? log.action ?? log.activity_type ?? log.type ?? 'event';
  const description = log.comments ?? log.description ?? log.message ?? log.summary ?? '';
  const when = log.created_at ?? log.createdAt ?? log.timestamp;
  const userName =
    log.user_name ||
    log.userName ||
    (log.user ? `${log.user.firstName ?? ''} ${log.user.lastName ?? ''}`.trim() : '') ||
    log.email ||
    '';
  const tone = pickTone(action);

  return (
    <Card padding="s4">
      <View style={{ flexDirection: 'row', gap: t.spacing.s3 }}>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            backgroundColor: t.colors[`${tone}Tint`] ?? t.colors.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name={iconFor(action)} size={18} color={t.colors[tone] ?? t.colors.primary} />
        </View>
        <View style={{ flex: 1 }}>
          <BodyStrong>{String(action).replace(/_/g, ' ')}</BodyStrong>
          {description ? (
            <Body color={t.colors.textSecondary} style={{ marginTop: 2 }} numberOfLines={3}>
              {description}
            </Body>
          ) : null}
          <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: 4, flexWrap: 'wrap' }}>
            {userName ? <Caption>{userName}</Caption> : null}
            {when ? <Caption>{new Date(when).toLocaleString()}</Caption> : null}
          </View>
        </View>
      </View>
    </Card>
  );
}

function pickTone(action) {
  const s = String(action ?? '').toLowerCase();
  if (s.includes('delete') || s.includes('remove') || s.includes('reject')) return 'danger';
  if (s.includes('create') || s.includes('approve') || s.includes('accept')) return 'success';
  if (s.includes('update') || s.includes('edit')) return 'warning';
  if (s.includes('login') || s.includes('logout')) return 'info';
  return 'primary';
}

function iconFor(action) {
  const s = String(action ?? '').toLowerCase();
  if (s.includes('delete')) return 'trash';
  if (s.includes('create')) return 'add-circle';
  if (s.includes('update') || s.includes('edit')) return 'create';
  if (s.includes('login')) return 'log-in';
  if (s.includes('logout')) return 'log-out';
  if (s.includes('approve')) return 'checkmark-circle';
  if (s.includes('reject')) return 'close-circle';
  if (s.includes('onboard')) return 'pulse';
  return 'document-text';
}
