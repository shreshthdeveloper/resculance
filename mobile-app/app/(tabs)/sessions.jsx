// Sessions tab — segmented Active / History list of sessions the paramedic
// can access. Active combines onboarded + in_transit.

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import { errorMessage } from '../../src/api/client';
import { listSessions } from '../../src/api/sessions';
import { useAuth } from '../../src/store/auth';
import { useTheme } from '../../src/theme';
import {
  Badge,
  BodyStrong,
  Card,
  Caption,
  EmptyState,
  OrgPicker,
  OrgPickerEmpty,
  Screen,
  Small,
  toneForStatus,
} from '../../src/ui';

export default function SessionsScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const activeOrg = useAuth((s) => s.activeOrg);
  const [tab, setTab] = useState('active');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  // Superadmin needs to pick an org before the backend will return sessions
  // (it returns 400 otherwise). Skip the fetch until they do.
  const gatedBySuperadminOrg = user?.role === 'superadmin' && !activeOrg;

  const load = useCallback(async (which) => {
    setErr(null);
    if (gatedBySuperadminOrg) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      if (which === 'active') {
        const [a, b] = await Promise.all([
          listSessions({ status: 'onboarded', limit: 50 }),
          listSessions({ status: 'in_transit', limit: 50 }),
        ]);
        setItems([...a.sessions, ...b.sessions]);
      } else {
        // Include cancelled sessions in the history view so users can
        // see those too — backend only filters by exact status string,
        // so we issue two requests and concat.
        const [done, cancelled] = await Promise.all([
          listSessions({ status: 'offboarded', limit: 50 }),
          listSessions({ status: 'cancelled', limit: 50 }).catch(() => ({ sessions: [] })),
        ]);
        setItems([...done.sessions, ...cancelled.sessions]);
      }
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatedBySuperadminOrg]);

  useFocusEffect(
    useCallback(() => {
      // Clear list immediately on tab switch so we don't briefly render
      // the previous tab's contents while the new tab is loading.
      setItems([]);
      setLoading(true);
      load(tab);
    }, [load, tab]),
  );

  // Re-fetch when a superadmin switches the "viewing as" org.
  useEffect(() => {
    if (user?.role !== 'superadmin') return;
    setItems([]);
    setLoading(!gatedBySuperadminOrg);
    load(tab);
  }, [activeOrg?.id, user?.role, gatedBySuperadminOrg, load, tab]);

  const isSuperadmin = user?.role === 'superadmin';

  return (
    <Screen>
      <FlatList
        contentContainerStyle={{
          padding: t.spacing.s5,
          paddingTop: t.spacing.s4,
          gap: t.spacing.s3,
        }}
        data={gatedBySuperadminOrg || loading ? [] : items}
        keyExtractor={(s) => s.id}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load(tab);
            }}
            tintColor={t.colors.primary}
            colors={[t.colors.primary]}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: t.spacing.s3 }}>
            {isSuperadmin ? <OrgPicker /> : null}
            <SegmentedControl
              value={tab}
              onChange={setTab}
              options={[
                { value: 'active', label: 'Active' },
                { value: 'history', label: 'History' },
              ]}
            />
          </View>
        }
        ListEmptyComponent={
          gatedBySuperadminOrg ? (
            <OrgPickerEmpty resource="sessions" />
          ) : loading ? (
            <View style={{ alignItems: 'center', padding: t.spacing.s8 }}>
              <ActivityIndicator color={t.colors.primary} />
            </View>
          ) : (
            <EmptyState
              icon={tab === 'active' ? 'pulse-outline' : 'time-outline'}
              title={tab === 'active' ? 'No active sessions' : 'No past sessions'}
              subtitle={
                err ??
                (tab === 'active'
                  ? 'Onboard a patient from the My ambulance tab to start a new session.'
                  : 'Once you complete sessions they will be archived here.')
              }
            />
          )
        }
        renderItem={({ item }) => <SessionRow item={item} onPress={() => router.push(`/session/${item.id}`)} />}
      />
    </Screen>
  );
}

function SegmentedControl({ value, onChange, options }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.colors.surfaceAlt,
        borderRadius: t.radius.xl,
        padding: 4,
        marginVertical: t.spacing.s4,
      }}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              {
                flex: 1,
                paddingVertical: t.spacing.s3,
                borderRadius: t.radius.lg,
                alignItems: 'center',
                backgroundColor: active ? t.colors.card : 'transparent',
              },
              active && {
                shadowColor: t.colors.shadow,
                shadowOpacity: t.colors.shadowOpacity,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Small
              color={active ? t.colors.text : t.colors.textSecondary}
              style={{ fontWeight: active ? '600' : '500' }}
            >
              {o.label}
            </Small>
          </Pressable>
        );
      })}
    </View>
  );
}

function SessionRow({ item, onPress }) {
  const t = useTheme();
  return (
    <Card onPress={onPress} padding="s4">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: t.colors.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="person" color={t.colors.primary} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <BodyStrong numberOfLines={1}>
            {item.patient_first_name} {item.patient_last_name}
          </BodyStrong>
          <Caption numberOfLines={1}>
            {item.session_code} · {item.ambulance_code}
          </Caption>
          {item.destination_hospital_name ? (
            <Caption numberOfLines={1} style={{ marginTop: 1 }}>
              → {item.destination_hospital_name}
            </Caption>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end', gap: 6 }}>
          <Badge label={item.status.replace('_', ' ')} tone={toneForStatus(item.status)} />
          <Caption>
            {new Date(item.onboarded_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </Caption>
        </View>
      </View>
    </Card>
  );
}
