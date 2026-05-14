// Sessions tab — segmented Active / History list of sessions the paramedic
// can access. Active combines onboarded + in_transit.

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  View,
} from 'react-native';
import { errorMessage } from '../../src/api/client';
import { listSessions, offboardSession } from '../../src/api/sessions';
import { useAuth } from '../../src/store/auth';
import { useTheme } from '../../src/theme';
import {
  Badge,
  Body,
  BodyStrong,
  Button,
  Card,
  Caption,
  EmptyState,
  OrgPicker,
  OrgPickerEmpty,
  Screen,
  SkeletonRow,
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
      } else if (which === 'history') {
        // Include cancelled sessions in the history view so users can
        // see those too — backend only filters by exact status string,
        // so we issue two requests and concat.
        const [done, cancelled] = await Promise.all([
          listSessions({ status: 'offboarded', limit: 50 }),
          listSessions({ status: 'cancelled', limit: 50 }).catch(() => ({ sessions: [] })),
        ]);
        setItems([...done.sessions, ...cancelled.sessions]);
      } else {
        // 'all' — single request without a status filter. Helpful when the
        // user is trying to confirm the API works regardless of status.
        const r = await listSessions({ limit: 100 });
        setItems(r.sessions ?? []);
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

  // Inline offboard from the list — no need to dive into detail. The
  // backend takes an optional treatmentNotes; we keep that for the detail
  // screen where the user can write something thoughtful, and just confirm
  // here.
  const onQuickOffboard = (s) => {
    Alert.alert(
      `Offboard ${s.patient_first_name} ${s.patient_last_name}?`,
      'Marks the session complete and releases the ambulance. You can add treatment notes from the session detail before offboarding instead.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Add notes first',
          onPress: () => router.push(`/session/${s.id}`),
        },
        {
          text: 'Offboard',
          style: 'destructive',
          onPress: async () => {
            try {
              await offboardSession(s.id);
              load(tab);
            } catch (e) {
              Alert.alert('Failed', errorMessage(e));
            }
          },
        },
      ],
    );
  };

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
                { value: 'all', label: 'All' },
              ]}
            />
            {/* Error banner — visible above the list when fetch fails. The
                empty state has the same message buried in its subtitle, but
                a real call failure deserves a prominent retry. */}
            {err && !loading ? (
              <Card
                padding="s4"
                style={{
                  borderColor: t.colors.error,
                  backgroundColor: t.colors.errorTint,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.s3 }}>
                  <Ionicons name="alert-circle" color={t.colors.error} size={20} />
                  <View style={{ flex: 1 }}>
                    <BodyStrong color={t.colors.error}>Couldn&apos;t load sessions</BodyStrong>
                    <Body color={t.colors.text} style={{ marginTop: 2 }}>
                      {err}
                    </Body>
                  </View>
                  <Button
                    label="Retry"
                    variant="outline"
                    size="sm"
                    onPress={() => {
                      setLoading(true);
                      load(tab);
                    }}
                  />
                </View>
              </Card>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          gatedBySuperadminOrg ? (
            <OrgPickerEmpty resource="sessions" />
          ) : loading ? (
            <View style={{ gap: t.spacing.s3 }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : (
            <EmptyState
              icon={tab === 'active' ? 'pulse-outline' : tab === 'history' ? 'time-outline' : 'pulse-outline'}
              title={
                tab === 'active' ? 'No active sessions'
                : tab === 'history' ? 'No past sessions'
                : 'No sessions yet'
              }
              subtitle={
                err
                  ? `${err}\n\nThis is the error returned by the backend. Pull to refresh, check your network, or verify you're signed in to an org that owns sessions.`
                  : tab === 'active'
                  ? `You're signed in as ${user?.role?.replace('_', ' ') ?? 'user'}${user?.organization ? ` in ${user.organization.name}` : ''}. Once a patient is onboarded into one of your ambulances, the session appears here.`
                  : tab === 'history'
                  ? 'Once you complete sessions they will be archived here.'
                  : `No sessions visible to you yet. If you expect to see some, verify you're signed in to the right org${isSuperadmin ? ' (use the picker above to switch viewing-as)' : ''}.`
              }
              action={
                tab === 'active' ? (
                  <Button
                    label="Onboard a patient"
                    onPress={() => router.push('/onboard')}
                    icon={<Ionicons name="add" color="#fff" size={18} />}
                  />
                ) : null
              }
            />
          )
        }
        renderItem={({ item }) => (
          <SessionRow
            item={item}
            onPress={() => router.push(`/session/${item.id}`)}
            onOffboard={() => onQuickOffboard(item)}
          />
        )}
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

function SessionRow({ item, onPress, onOffboard }) {
  const t = useTheme();
  const isActive = item.status === 'onboarded' || item.status === 'in_transit';
  return (
    <Card onPress={onPress} padding="s4">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: isActive ? t.colors.primary : t.colors.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={isActive ? 'pulse' : 'person'}
            color={isActive ? '#fff' : t.colors.primary}
            size={20}
          />
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
          <Badge label={(item.status ?? 'unknown').replace('_', ' ')} tone={toneForStatus(item.status)} />
          <Caption>
            {item.onboarded_at
              ? new Date(item.onboarded_at).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : ''}
          </Caption>
        </View>
      </View>

      {/* Inline actions on active rows: View + Offboard, no detail dive
          required. Tapping the row body still opens the detail. */}
      {isActive && onOffboard ? (
        <View
          style={{
            flexDirection: 'row',
            gap: t.spacing.s2,
            marginTop: t.spacing.s3,
            paddingTop: t.spacing.s3,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
          }}
        >
          <RowButton
            label="View"
            icon="eye-outline"
            onPress={onPress}
            variant="secondary"
            flex={1}
          />
          <RowButton
            label="Offboard"
            icon="exit-outline"
            onPress={onOffboard}
            variant="danger"
            flex={1}
          />
        </View>
      ) : null}
    </Card>
  );
}

// Compact inline button used inside row cards. Tappable independently of
// the parent Card's onPress (stopPropagation via a Pressable wrapper that
// swallows the bubble).
function RowButton({ label, icon, onPress, variant = 'secondary', flex = 1 }) {
  const t = useTheme();
  const palette = variant === 'danger'
    ? { bg: t.colors.errorTint, fg: t.colors.error, border: t.colors.error }
    : { bg: t.colors.surfaceAlt, fg: t.colors.text, border: t.colors.border };
  return (
    <Pressable
      onPress={(e) => {
        // Prevent the surrounding Card's onPress from also firing — RN
        // doesn't bubble Pressable events automatically, but inside a
        // Card-Pressable the wrapper does. Stop it explicitly.
        e.stopPropagation?.();
        onPress?.();
      }}
      hitSlop={4}
      style={({ pressed }) => [
        {
          flex,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingVertical: t.spacing.s2 + 2,
          paddingHorizontal: t.spacing.s3,
          borderRadius: t.radius.lg,
          backgroundColor: palette.bg,
          borderWidth: 1,
          borderColor: variant === 'danger' ? palette.border + '33' : palette.border,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Ionicons name={icon} color={palette.fg} size={15} />
      <Small color={palette.fg} style={{ fontWeight: '700', fontSize: 12.5 }}>
        {label}
      </Small>
    </Pressable>
  );
}
