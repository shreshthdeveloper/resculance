// Patient Onboarding — direct port of the web frontend's /onboarding page.
//
// Layout: ambulance-centric. Pick an org → list every ambulance in it →
// each row shows its status + onboarding status + per-row actions:
//
//   - Ambulance status ∈ ['active','onboarded','in_transit']
//                                         → an onboarding is in progress.
//                                           We fetch its session via
//                                           /patients/sessions?ambulanceId=X&limit=1.
//                                           If returned, show View + Offboard
//                                           and make the whole row tappable.
//                                           If `hasSession` is true but the
//                                           session body was redacted (the
//                                           viewer can't access the patient),
//                                           show an explanatory note.
//   - status === 'available' (etc.)       → no active onboarding. Show
//                                           "Onboard Patient" → routes to
//                                           /onboard?ambulanceId=X so the
//                                           confirm step pre-picks.
//   - status === 'inactive'               → no actions; "Ambulance Inactive".

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  TextInput,
  View,
} from 'react-native';
import {
  getMyAmbulances,
  listAmbulancesForOrg,
} from '../src/api/ambulances';
import { errorMessage } from '../src/api/client';
import {
  getActiveSessionForAmbulance,
  offboardSession,
} from '../src/api/sessions';
import { useAuth } from '../src/store/auth';
import { useTheme } from '../src/theme';
import {
  Badge,
  Body,
  BodyStrong,
  Button,
  Card,
  Caption,
  EmptyState,
  H1,
  OrgPicker,
  OrgPickerEmpty,
  Screen,
  SkeletonRow,
  Small,
  toneForStatus,
} from '../src/ui';

// Ambulance statuses that indicate the unit is currently carrying a
// patient — for these we hit /patients/sessions?ambulanceId=X to find the
// running session.
//
// In the live backend, `patientController.onboard` flips the ambulance to
// `'active'` (patientController.js:673) and the offboard flow flips it back
// to `'available'`. `'on_trip'` and `'en_route'` are also valid Mongo enum
// states that admins or future hardware integrations might set, so include
// them too. The legacy `'onboarded'` / `'in_transit'` values are session-
// scoped (PatientSession enum), not ambulance-scoped — kept as defensive
// fallbacks for any stale data.
const IN_PROGRESS_AMB_STATUSES = new Set(['active', 'on_trip', 'en_route', 'onboarded', 'in_transit']);

export default function OnboardingsScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const activeOrg = useAuth((s) => s.activeOrg);

  const [ambulances, setAmbulances] = useState([]);
  // ambulance_id (string) → { session, hasSession, redacted } | undefined.
  // undefined means we haven't fetched it yet (loader); null session +
  // redacted=false means there's no session.
  const [sessionsByAmb, setSessionsByAmb] = useState({});
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const isSuperadmin = user?.role === 'superadmin';
  const gatedBySuperadminOrg = isSuperadmin && !activeOrg;

  const orgName = isSuperadmin
    ? activeOrg?.name ?? ''
    : user?.organization?.name ?? '';

  const load = useCallback(async () => {
    setErr(null);
    if (gatedBySuperadminOrg) {
      setAmbulances([]);
      setSessionsByAmb({});
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      // Same scoping as the rest of the app: superadmin → org-wide via
      // /ambulances; paramedics → /my-ambulances (assigned only).
      const ambPromise = isSuperadmin
        ? listAmbulancesForOrg({ limit: 200 })
        : getMyAmbulances();
      const ambs = await ambPromise;
      setAmbulances(ambs);

      // For each in-progress ambulance, fetch its active session in
      // parallel. This mirrors the web's fetchSessionForAmbulance() and
      // returns the `hasSession` flag so we can detect redacted sessions.
      const inProgress = ambs.filter((a) =>
        IN_PROGRESS_AMB_STATUSES.has((a.status ?? '').toString().toLowerCase()),
      );
      const entries = await Promise.all(
        inProgress.map(async (a) => {
          try {
            const r = await getActiveSessionForAmbulance(a.id);
            return [String(a.id), r];
          } catch {
            return [String(a.id), { session: null, hasSession: false, redacted: false }];
          }
        }),
      );
      const map = {};
      for (const [id, r] of entries) map[id] = r;
      setSessionsByAmb(map);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatedBySuperadminOrg, isSuperadmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (!isSuperadmin) return;
    setLoading(!gatedBySuperadminOrg);
    load();
  }, [activeOrg?.id, isSuperadmin, gatedBySuperadminOrg, load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return ambulances;
    return ambulances.filter((a) => {
      return (
        (a.ambulance_code ?? '').toLowerCase().includes(term) ||
        (a.registration_number ?? '').toLowerCase().includes(term) ||
        (a.vehicle_model ?? '').toLowerCase().includes(term)
      );
    });
  }, [ambulances, q]);

  const onOffboard = (amb, session) => {
    if (!session) return;
    Alert.alert(
      `Offboard ${amb.ambulance_code}?`,
      `Ends the session for ${session.patient_first_name ?? 'the patient'} and releases the ambulance.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'View console',
          onPress: () => router.push(`/session/${session.id}`),
        },
        {
          text: 'Offboard',
          style: 'destructive',
          onPress: async () => {
            try {
              await offboardSession(session.id);
              load();
            } catch (e) {
              Alert.alert('Failed', errorMessage(e));
            }
          },
        },
      ],
    );
  };

  return (
    <Screen edges={['bottom']}>
      <FlatList
        contentContainerStyle={{
          padding: t.spacing.s5,
          paddingBottom: t.spacing.s12,
          gap: t.spacing.s3,
        }}
        data={loading || gatedBySuperadminOrg ? [] : filtered}
        keyExtractor={(a) => a.id}
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
        ListHeaderComponent={
          <View style={{ gap: t.spacing.s3, marginBottom: t.spacing.s3 }}>
            <View>
              <H1>Patient Onboarding</H1>
              <Small style={{ marginTop: 4 }}>
                Select an ambulance and onboard patients
              </Small>
            </View>

            {isSuperadmin ? <OrgPicker /> : null}

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
                opacity: gatedBySuperadminOrg ? 0.5 : 1,
              }}
              pointerEvents={gatedBySuperadminOrg ? 'none' : 'auto'}
            >
              <Ionicons name="search" size={18} color={t.colors.textMuted} />
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Search ambulances…"
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

            {orgName && !gatedBySuperadminOrg ? (
              <Caption style={{ letterSpacing: 1.2, fontWeight: '700', textAlign: 'center' }}>
                {orgName.toUpperCase()} AMBULANCES
              </Caption>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          gatedBySuperadminOrg ? (
            <OrgPickerEmpty resource="ambulances" />
          ) : loading ? (
            <View style={{ gap: t.spacing.s3 }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : (
            <EmptyState
              icon="car-sport-outline"
              title="No ambulances"
              subtitle={
                err ??
                (q
                  ? 'No ambulances match that search.'
                  : isSuperadmin
                  ? 'This organization has no ambulances.'
                  : 'You are not assigned to any ambulances yet.')
              }
            />
          )
        }
        renderItem={({ item }) => (
          <AmbulanceOnboardingRow
            amb={item}
            ambSession={sessionsByAmb[String(item.id)]}
            onView={(s) => router.push(`/session/${s.id}`)}
            onOffboard={(s) => onOffboard(item, s)}
            onOnboard={() =>
              router.push({
                pathname: '/onboard',
                params: { ambulanceId: String(item.id) },
              })
            }
          />
        )}
      />
    </Screen>
  );
}

// Renders one ambulance row. The whole row is a Pressable (Card with
// onPress) when there's a viewable active session, so tapping anywhere —
// the icon, the "Active Onboarding" text, or the buttons — opens the
// session console. Matches the web's "click row → /onboarding/[sessionId]"
// behaviour.
function AmbulanceOnboardingRow({ amb, ambSession, onView, onOffboard, onOnboard }) {
  const t = useTheme();
  const status = (amb.status ?? 'unknown').toString().toLowerCase();
  const inProgress = IN_PROGRESS_AMB_STATUSES.has(status);
  const isInactive = status === 'inactive';

  // Distinguish three onboarding-state cases that the web also distinguishes:
  //   - real session loaded → tappable, View + Offboard
  //   - hasSession but redacted → show outbound note, no actions
  //   - in-progress but session info not loaded yet → "Loading…"
  //   - not in-progress → no onboarding
  const session = ambSession?.session ?? null;
  const redacted = ambSession?.redacted ?? false;
  const fetched = ambSession !== undefined;
  const hasViewableSession = !!session;

  const cardOnPress = hasViewableSession ? () => onView(session) : null;

  return (
    <Card padding="s4" onPress={cardOnPress}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
        <View
          style={{
            width: 48,
            height: 48,
            borderRadius: 12,
            backgroundColor: inProgress ? t.colors.successTint : t.colors.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name="car-sport"
            color={inProgress ? t.colors.success : t.colors.primary}
            size={22}
          />
        </View>
        <View style={{ flex: 1 }}>
          <BodyStrong numberOfLines={1}>{amb.ambulance_code}</BodyStrong>
          <Caption numberOfLines={1}>
            {amb.registration_number}
            {amb.vehicle_model ? ` · ${amb.vehicle_model}` : ''}
          </Caption>
          {amb.vehicle_type || amb.ambulance_type ? (
            <Caption numberOfLines={1}>
              Type: {(amb.vehicle_type ?? amb.ambulance_type ?? '').toUpperCase()}
            </Caption>
          ) : null}
        </View>
        <Badge label={status.replace('_', ' ')} tone={toneForStatus(status)} dot />
      </View>

      {/* Onboarding status line — also tappable when there's a viewable
          session, so the user can tap the green "Active Onboarding" text
          directly to open the console (matching the web's affordance). */}
      <Pressable
        onPress={hasViewableSession ? () => onView(session) : undefined}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.s2,
          marginTop: t.spacing.s3,
          paddingTop: t.spacing.s3,
          borderTopWidth: 1,
          borderTopColor: t.colors.border,
        }}
      >
        <View
          style={{
            width: 8,
            height: 8,
            borderRadius: 4,
            backgroundColor: inProgress ? t.colors.success : t.colors.textMuted,
          }}
        />
        <Body color={inProgress ? t.colors.success : t.colors.textSecondary} style={{ fontWeight: '600' }}>
          {inProgress ? 'Active Onboarding' : 'No Active Onboarding'}
        </Body>
        {session?.patient_first_name ? (
          <Caption numberOfLines={1} style={{ flex: 1 }}>
            · {session.patient_first_name} {session.patient_last_name ?? ''}
          </Caption>
        ) : null}
        {hasViewableSession ? (
          <Ionicons name="chevron-forward" size={16} color={t.colors.textMuted} />
        ) : null}
      </Pressable>

      {/* Per-row actions. Layout mirrors the web's column. */}
      <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s3 }}>
        {isInactive ? (
          <View style={{ flex: 1, paddingVertical: t.spacing.s2 }}>
            <Caption style={{ fontStyle: 'italic', textAlign: 'center' }}>
              Ambulance inactive
            </Caption>
          </View>
        ) : inProgress ? (
          !fetched ? (
            // Session lookup still in flight.
            <Caption style={{ flex: 1, textAlign: 'center', fontStyle: 'italic' }}>
              Loading session…
            </Caption>
          ) : hasViewableSession ? (
            <>
              <Button
                label="View"
                variant="secondary"
                size="sm"
                icon={<Ionicons name="eye-outline" size={14} color={t.colors.text} />}
                onPress={() => onView(session)}
                style={{ flex: 1 }}
              />
              <Button
                label="Offboard"
                variant="danger"
                size="sm"
                icon={<Ionicons name="exit-outline" size={14} color="#fff" />}
                onPress={() => onOffboard(session)}
                style={{ flex: 1 }}
              />
            </>
          ) : redacted ? (
            <Caption style={{ flex: 1, textAlign: 'center', fontStyle: 'italic', color: t.colors.warning }}>
              This ambulance is outbound for a different hospital.
            </Caption>
          ) : (
            // In-progress but the backend returned no session and no
            // hasSession flag. This shouldn't normally happen — surface a
            // gentle diagnostic so it's clear why no actions appear.
            <Caption style={{ flex: 1, textAlign: 'center', fontStyle: 'italic' }}>
              Active, but no session details available.
            </Caption>
          )
        ) : (
          <Button
            label="Onboard patient"
            size="sm"
            icon={<Ionicons name="person-add" size={14} color="#fff" />}
            onPress={onOnboard}
            fullWidth
          />
        )}
      </View>
    </Card>
  );
}
