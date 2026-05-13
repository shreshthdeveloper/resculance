// Dashboard — the home tab. Greeting + role badge, stat grid (mirrors
// frontend/src/pages/dashboard/Dashboard.jsx), and quick-action shortcuts.

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { getMyAmbulances, listAmbulancesForOrg } from '../../src/api/ambulances';
import { errorMessage } from '../../src/api/client';
import { getDashboardStats } from '../../src/api/dashboard';
import { listSessions } from '../../src/api/sessions';
import { useAuth } from '../../src/store/auth';
import { useTheme } from '../../src/theme';
import {
  Badge,
  Body,
  Card,
  H1,
  H2,
  H3,
  OrgPicker,
  SectionHeader,
  Small,
  Screen,
  toneForStatus,
} from '../../src/ui';

export default function DashboardScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const activeOrg = useAuth((s) => s.activeOrg);

  const [stats, setStats] = useState(null);
  const [ambulance, setAmbulance] = useState(null);
  const [activeSession, setActiveSession] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const isSuperadmin = user?.role === 'superadmin';
  // Dashboard stats work for superadmin (system-wide); only the per-org
  // widgets (ambulance, active session) need to wait for an org pick.
  const orgScopedHidden = isSuperadmin && !activeOrg;

  const load = useCallback(async () => {
    setErr(null);
    try {
      // /dashboard/stats has its own superadmin branch on the backend — it
      // returns system-wide counts and does not consult organizationId.
      const statsPromise = getDashboardStats().catch(() => ({}));

      // Per-org widgets — skip entirely until a superadmin picks an org.
      // Paramedics use /my-ambulances; superadmin (with org) uses /ambulances.
      const ambPromise = orgScopedHidden
        ? Promise.resolve([])
        : (isSuperadmin ? listAmbulancesForOrg({ limit: 20 }) : getMyAmbulances()).catch(() => []);
      const onboardedPromise = orgScopedHidden
        ? Promise.resolve({ sessions: [] })
        : listSessions({ status: 'onboarded', limit: 20 }).catch(() => ({ sessions: [] }));
      const transitPromise = orgScopedHidden
        ? Promise.resolve({ sessions: [] })
        : listSessions({ status: 'in_transit', limit: 20 }).catch(() => ({ sessions: [] }));

      const [s, ambs, onboarded, transit] = await Promise.all([
        statsPromise,
        ambPromise,
        onboardedPromise,
        transitPromise,
      ]);
      setStats(s);
      const myAmb = ambs[0] ?? null;
      setAmbulance(myAmb);
      if (myAmb) {
        const all = [...onboarded.sessions, ...transit.sessions];
        setActiveSession(all.find((x) => String(x.ambulance_id) === String(myAmb.id)) ?? null);
      } else {
        setActiveSession(null);
      }
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setRefreshing(false);
    }
  }, [orgScopedHidden, isSuperadmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Re-fetch when the superadmin switches "viewing as" org.
  useEffect(() => {
    if (!isSuperadmin) return;
    load();
  }, [activeOrg?.id, isSuperadmin, load]);

  const greeting = getGreeting();
  const statCards = pickStatCards(stats);

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ padding: t.spacing.s5, paddingBottom: t.spacing.s10 }}
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
      >
        {/* Greeting */}
        <View style={{ marginBottom: t.spacing.s6 }}>
          <Small>{greeting}</Small>
          <H1 style={{ marginTop: 2 }}>
            {user?.firstName ?? 'Welcome'}
          </H1>
          <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s2, flexWrap: 'wrap' }}>
            <Badge label={user?.role?.replace('_', ' ') ?? 'user'} tone="primary" />
            {user?.organization ? (
              <Badge label={user.organization.name} tone="neutral" />
            ) : null}
            {isSuperadmin && activeOrg ? (
              <Badge label={`Viewing: ${activeOrg.name}`} tone="info" />
            ) : null}
          </View>
        </View>

        {/* Superadmin org picker — selected org persists across screens. */}
        {isSuperadmin ? (
          <View style={{ marginBottom: t.spacing.s5 }}>
            <OrgPicker />
          </View>
        ) : null}

        {/* Active operation banner — needs an org pick for superadmin. */}
        {activeSession && !orgScopedHidden ? (
          <Card
            level={2}
            padding="s5"
            style={{
              backgroundColor: t.colors.primary,
              borderColor: t.colors.primary,
              marginBottom: t.spacing.s5,
            }}
            onPress={() => router.push(`/session/${activeSession.id}`)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: 'rgba(255,255,255,0.2)',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="pulse" color="#fff" size={22} />
              </View>
              <View style={{ flex: 1 }}>
                <Small color="rgba(255,255,255,0.85)" style={{ fontWeight: '600' }}>
                  ACTIVE SESSION · {activeSession.session_code}
                </Small>
                <H3 color="#FFFFFF" style={{ marginTop: 2 }}>
                  {activeSession.patient_first_name} {activeSession.patient_last_name}
                </H3>
                <Small color="rgba(255,255,255,0.85)">
                  {activeSession.status.replace('_', ' ')} · tap to open
                </Small>
              </View>
              <Ionicons name="chevron-forward" color="#fff" size={22} />
            </View>
          </Card>
        ) : null}

        {/* Stat grid */}
        {statCards.length > 0 && (
          <>
            <SectionHeader title="Overview" />
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                gap: t.spacing.s3,
                marginBottom: t.spacing.s5,
              }}
            >
              {statCards.map((s) => (
                <StatCard key={s.label} {...s} />
              ))}
            </View>
          </>
        )}

        {/* My ambulance shortcut — hidden until a superadmin picks an org. */}
        {!orgScopedHidden ? (
          <>
            <SectionHeader
              title={isSuperadmin ? 'Fleet preview' : 'My ambulance'}
              right={
                <Pressable onPress={() => router.push('/ambulance')}>
                  <Small color={t.colors.primary} style={{ fontWeight: '600' }}>
                    View all
                  </Small>
                </Pressable>
              }
            />
            {ambulance ? (
              <Card onPress={() => router.push('/ambulance')}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
                  <View
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 12,
                      backgroundColor: t.colors.primaryTint,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Ionicons name="car-sport" color={t.colors.primary} size={24} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <H3>{ambulance.ambulance_code}</H3>
                    <Small>{ambulance.registration_number}</Small>
                  </View>
                  <Badge
                    label={ambulance.status.replace('_', ' ')}
                    tone={toneForStatus(ambulance.status)}
                  />
                </View>
              </Card>
            ) : (
              <Card>
                <View style={{ alignItems: 'center', paddingVertical: t.spacing.s4 }}>
                  <Ionicons name="car-sport-outline" size={32} color={t.colors.textMuted} />
                  <Body color={t.colors.textSecondary} style={{ marginTop: t.spacing.s2 }}>
                    {isSuperadmin
                      ? 'No ambulances in this organization.'
                      : 'No ambulance assigned yet.'}
                  </Body>
                </View>
              </Card>
            )}
          </>
        ) : null}

        {/* Quick actions */}
        <SectionHeader title="Quick actions" style={{ marginTop: t.spacing.s5 }} />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s3 }}>
          <QuickAction
            icon="add-circle"
            label="Onboard patient"
            onPress={() => router.push('/onboard')}
          />
          <QuickAction
            icon="people"
            label="Browse patients"
            onPress={() => router.push('/onboard')}
          />
          <QuickAction
            icon="pulse"
            label="All sessions"
            onPress={() => router.push('/sessions')}
          />
          <QuickAction
            icon="settings"
            label="Settings"
            onPress={() => router.push('/settings')}
          />
        </View>

        {err ? (
          <Small color={t.colors.error} style={{ marginTop: t.spacing.s5, textAlign: 'center' }}>
            {err}
          </Small>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

// Half-width that accounts for the parent's `gap: s3` (12px). Two cards
// at this basis + 12px gap fit exactly. RN flexbox with `gap` adds the gap
// AFTER basis, so naive 50% / 47% bases overflow and wrap to one column.
const HALF = '48%';

function StatCard({ label, value, icon, tone }) {
  const t = useTheme();
  return (
    <Card
      padding="s4"
      style={{ width: HALF }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 10,
          backgroundColor: t.colors[`${tone}Tint`] ?? t.colors.primaryTint,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: t.spacing.s3,
        }}
      >
        <Ionicons name={icon} size={18} color={t.colors[tone] ?? t.colors.primary} />
      </View>
      <H2>{value}</H2>
      <Small style={{ marginTop: 2 }}>{label}</Small>
    </Card>
  );
}

function QuickAction({ icon, label, onPress }) {
  const t = useTheme();
  return (
    <Card
      onPress={onPress}
      padding="s4"
      style={{ width: HALF, alignItems: 'center' }}
    >
      <View
        style={{
          width: 44,
          height: 44,
          borderRadius: 22,
          backgroundColor: t.colors.primaryTint,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: t.spacing.s3,
        }}
      >
        <Ionicons name={icon} color={t.colors.primary} size={22} />
      </View>
      <Small color={t.colors.text} style={{ fontWeight: '600', textAlign: 'center' }}>
        {label}
      </Small>
    </Card>
  );
}

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

// Pick a sensible 2-4 cards from whatever the dashboard endpoint returned
// (shape varies by role). Falls back to nothing if the call failed.
function pickStatCards(stats) {
  if (!stats) return [];
  const cards = [];
  if (stats.activeTrips != null)
    cards.push({ label: 'Active trips', value: stats.activeTrips, icon: 'pulse', tone: 'primary' });
  if (stats.totalAmbulances != null)
    cards.push({
      label: 'Ambulances',
      value: stats.totalAmbulances,
      icon: 'car-sport',
      tone: 'info',
    });
  if (stats.totalPatients != null)
    cards.push({
      label: 'Patients',
      value: stats.totalPatients,
      icon: 'people',
      tone: 'success',
    });
  if (stats.totalCollaborations != null)
    cards.push({
      label: 'Partnerships',
      value: stats.totalCollaborations,
      icon: 'git-network',
      tone: 'warning',
    });
  return cards;
}
