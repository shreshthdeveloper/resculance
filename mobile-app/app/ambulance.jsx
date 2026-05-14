// My Ambulance — full detail on the paramedic's assigned ambulance(s),
// active session shortcut, location stamp, and onboarding action.

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, RefreshControl, View } from 'react-native';
import { getMyAmbulances, listAmbulancesForOrg } from '../src/api/ambulances';
import { errorMessage } from '../src/api/client';
import { listSessions } from '../src/api/sessions';
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
  H3,
  OrgPicker,
  OrgPickerEmpty,
  Screen,
  Skeleton,
  SkeletonRow,
  Small,
  toneForStatus,
} from '../src/ui';

export default function MyAmbulanceScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const activeOrg = useAuth((s) => s.activeOrg);
  const [ambulances, setAmbulances] = useState([]);
  const [activeSessions, setActiveSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);

  const isSuperadmin = user?.role === 'superadmin';
  const gatedBySuperadminOrg = isSuperadmin && !activeOrg;

  const load = useCallback(async () => {
    setErr(null);
    if (gatedBySuperadminOrg) {
      setAmbulances([]);
      setActiveSessions([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      // Superadmin: fetch the selected org's full fleet via /ambulances
      // (the active org id is injected by the API client). Paramedics use
      // /my-ambulances, which returns only their assigned vehicles.
      const ambPromise = isSuperadmin ? listAmbulancesForOrg({ limit: 50 }) : getMyAmbulances();
      const [amb, onboarded, transit] = await Promise.all([
        ambPromise,
        listSessions({ status: 'onboarded', limit: 50 }),
        listSessions({ status: 'in_transit', limit: 50 }),
      ]);
      setAmbulances(amb);
      const ambIds = new Set(amb.map((a) => String(a.id)));
      setActiveSessions(
        [...onboarded.sessions, ...transit.sessions].filter((s) =>
          ambIds.has(String(s.ambulance_id)),
        ),
      );
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatedBySuperadminOrg, isSuperadmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Re-fetch when the superadmin switches org.
  useEffect(() => {
    if (!isSuperadmin) return;
    setLoading(!gatedBySuperadminOrg);
    load();
  }, [activeOrg?.id, isSuperadmin, gatedBySuperadminOrg, load]);

  return (
    <Screen>
      <FlatList
        data={gatedBySuperadminOrg || loading ? [] : ambulances}
        keyExtractor={(a) => a.id}
        contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s4 }}
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
        ListHeaderComponent={isSuperadmin ? <OrgPicker /> : null}
        ListEmptyComponent={
          gatedBySuperadminOrg ? (
            <OrgPickerEmpty resource="ambulances" />
          ) : loading ? (
            <View style={{ gap: t.spacing.s4 }}>
              <SkeletonAmbulanceCard />
              <SkeletonRow />
            </View>
          ) : (
            <EmptyState
              icon="car-sport-outline"
              title={isSuperadmin ? 'No ambulances in this org' : 'No ambulance assigned'}
              subtitle={
                err ??
                (isSuperadmin
                  ? 'This organization does not have any ambulances yet.'
                  : 'Once a fleet admin assigns you to an ambulance, it will appear here.')
              }
            />
          )
        }
        renderItem={({ item }) => {
          const session = activeSessions.find(
            (s) => String(s.ambulance_id) === String(item.id),
          );
          return (
            <Card padding="s5">
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <View style={{ flex: 1 }}>
                  <H3 style={{ marginBottom: 2 }}>{item.ambulance_code}</H3>
                  <Body color={t.colors.textSecondary}>{item.registration_number}</Body>
                </View>
                <Badge
                  label={(item.status ?? 'unknown').replace('_', ' ')}
                  tone={toneForStatus(item.status)}
                  dot
                />
              </View>

              <View
                style={{
                  flexDirection: 'row',
                  flexWrap: 'wrap',
                  gap: t.spacing.s4,
                  marginTop: t.spacing.s4,
                  paddingTop: t.spacing.s4,
                  borderTopWidth: 1,
                  borderTopColor: t.colors.border,
                }}
              >
                {item.vehicle_model ? (
                  <MetaRow icon="car-outline" label="Vehicle" value={item.vehicle_model} />
                ) : null}
                <MetaRow icon="business-outline" label="Operator" value={item.organization_name} />
                {item.current_hospital_name ? (
                  <MetaRow icon="medkit-outline" label="At hospital" value={item.current_hospital_name} />
                ) : null}
                {item.last_location_update ? (
                  <MetaRow
                    icon="location-outline"
                    label="Last ping"
                    value={new Date(item.last_location_update).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  />
                ) : null}
              </View>

              {session ? (
                <Card
                  padding="s4"
                  level={0}
                  style={{
                    marginTop: t.spacing.s4,
                    backgroundColor: t.colors.primaryTint,
                    borderColor: t.colors.primary + '33',
                  }}
                  onPress={() => router.push(`/session/${session.id}`)}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
                    <Ionicons name="pulse" size={20} color={t.colors.primary} />
                    <View style={{ flex: 1 }}>
                      <BodyStrong>
                        {session.patient_first_name} {session.patient_last_name}
                      </BodyStrong>
                      <Small color={t.colors.primary} style={{ fontWeight: '600' }}>
                        {session.session_code} · {(session.status ?? 'unknown').replace('_', ' ')}
                      </Small>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={t.colors.primary} />
                  </View>
                </Card>
              ) : (
                <Button
                  label="Onboard a patient"
                  icon={<Ionicons name="add-circle-outline" color="#fff" size={18} />}
                  onPress={() => router.push('/onboard')}
                  fullWidth
                  style={{ marginTop: t.spacing.s4 }}
                />
              )}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

function SkeletonAmbulanceCard() {
  const t = useTheme();
  return (
    <View
      style={{
        padding: t.spacing.s5,
        backgroundColor: t.colors.card,
        borderRadius: t.radius.xl,
        borderWidth: 1,
        borderColor: t.colors.border,
        gap: t.spacing.s4,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <View style={{ flex: 1, gap: 6 }}>
          <Skeleton width="50%" height={18} />
          <Skeleton width="35%" height={12} />
        </View>
        <Skeleton width={80} height={22} radius={11} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s4 }}>
        <Skeleton width="45%" height={32} />
        <Skeleton width="45%" height={32} />
      </View>
    </View>
  );
}

function MetaRow({ icon, label, value }) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2, minWidth: '45%' }}>
      <Ionicons name={icon} size={16} color={t.colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Caption>{label}</Caption>
        <Body numberOfLines={1}>{value}</Body>
      </View>
    </View>
  );
}
