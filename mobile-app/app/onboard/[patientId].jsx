// Step 2 — confirm onboarding. Pick ambulance + trip details, then POST.

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { getMyAmbulances } from '../../src/api/ambulances';
import { errorMessage } from '../../src/api/client';
import { listMyPartnerships } from '../../src/api/collaborations';
import { getPatient, onboardPatient } from '../../src/api/patients';
import { useAuth } from '../../src/store/auth';
import { useTheme } from '../../src/theme';
import {
  Badge,
  Body,
  BodyStrong,
  Button,
  Card,
  Caption,
  H2,
  Input,
  Screen,
  SectionHeader,
  Skeleton,
  SkeletonRow,
  Small,
  toneForStatus,
} from '../../src/ui';

export default function ConfirmOnboardScreen() {
  const t = useTheme();
  const { patientId, ambulanceId: preselectedAmbulanceId } = useLocalSearchParams();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const activeOrg = useAuth((s) => s.activeOrg);

  // Effective org context drives destination-hospital behaviour. A superadmin
  // "viewing as" an org gets that org's type; everyone else uses their own.
  const isSuperadmin = user?.role === 'superadmin';
  const orgType = isSuperadmin ? activeOrg?.type : user?.organization?.type;
  const orgId = isSuperadmin ? activeOrg?.id : user?.organization?.id;
  const orgName = isSuperadmin ? activeOrg?.name : user?.organization?.name;
  const isHospitalContext = orgType === 'hospital';
  const isFleetContext = orgType === 'fleet_owner';

  const [patient, setPatient] = useState(null);
  const [ambulances, setAmbulances] = useState([]);
  const [selectedAmbId, setSelectedAmbId] = useState(null);
  // Backend validation REQUIRES destinationHospitalId. Hospital users auto-
  // select their own org; fleet users pick from approved partnerships.
  const [partneredHospitals, setPartneredHospitals] = useState([]);
  const [destinationHospitalId, setDestinationHospitalId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [complaint, setComplaint] = useState('');
  const [assessment, setAssessment] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const tasks = [getPatient(String(patientId)), getMyAmbulances()];
        // Only fleets need the partner list — hospitals self-destination.
        if (isFleetContext && orgId) tasks.push(listMyPartnerships());
        const [p, ambs, partnerships] = await Promise.all(tasks);

        setPatient(p);
        const usable = ambs.filter(
          (a) => a.status === 'available' || a.status === 'active',
        );
        setAmbulances(ambs);
        // If we arrived with a pre-selected ambulanceId (from /onboardings),
        // honour it when it appears in the user's accessible list; else
        // fall back to the first usable / first available.
        const preselected = preselectedAmbulanceId
          ? ambs.find((a) => String(a.id) === String(preselectedAmbulanceId))
          : null;
        setSelectedAmbId(preselected?.id ?? usable[0]?.id ?? ambs[0]?.id ?? null);

        // Wire up destination hospital. For hospital context this is
        // deterministic (own org); for fleet context we surface a picker
        // populated with partnered hospitals only.
        if (isHospitalContext && orgId) {
          setDestinationHospitalId(orgId);
        } else if (isFleetContext && Array.isArray(partnerships)) {
          // listMyPartnerships() server-side scopes to the JWT's org for
          // fleet/hospital users, but for superadmin returns all. Filter
          // client-side so superadmin viewing-as a fleet still works.
          const hospitals = partnerships
            .filter((pt) => {
              const fleetId = pt.fleet_id?._id ?? pt.fleet_id;
              return String(fleetId) === String(orgId);
            })
            .map((pt) => {
              const h = pt.hospital_id;
              const id = h?._id ?? h?.id ?? h;
              return id
                ? { id: String(id), name: h?.name ?? 'Hospital', code: h?.code ?? '' }
                : null;
            })
            .filter(Boolean);
          setPartneredHospitals(hospitals);
          if (hospitals.length === 1) {
            // Single partner → auto-pick. Matches the web's behaviour when
            // there's only one viable destination.
            setDestinationHospitalId(hospitals[0].id);
          }
        }
      } catch (e) {
        Alert.alert('Error', errorMessage(e), [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, router, preselectedAmbulanceId, isHospitalContext, isFleetContext, orgId]);

  const onConfirm = async () => {
    if (!selectedAmbId) {
      Alert.alert(
        'No ambulance',
        'You need an assigned ambulance to onboard a patient.',
      );
      return;
    }
    if (!destinationHospitalId) {
      Alert.alert(
        'No destination',
        isFleetContext
          ? 'Pick a destination hospital from your active partnerships.'
          : 'A destination hospital is required to onboard a patient.',
      );
      return;
    }
    setBusy(true);
    try {
      const r = await onboardPatient(String(patientId), {
        ambulanceId: selectedAmbId,
        destinationHospitalId,
        pickupLocation: pickup.trim() || 'Current Location',
        destinationLocation: destination.trim() || 'Hospital',
        chiefComplaint: complaint.trim() || undefined,
        initialAssessment: assessment.trim() || undefined,
      });
      router.replace(`/session/${r.sessionId}`);
    } catch (e) {
      Alert.alert('Onboarding failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <ScrollView contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s4 }}>
          <Card padding="s5">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
              <Skeleton width={52} height={52} radius={26} />
              <View style={{ flex: 1, gap: 6 }}>
                <Skeleton width="55%" height={20} />
                <Skeleton width="40%" height={12} />
              </View>
            </View>
          </Card>
          <SkeletonRow />
          <SkeletonRow />
          <Card padding="s5">
            <Skeleton width="40%" height={14} style={{ marginBottom: 12 }} />
            <Skeleton width="100%" height={44} style={{ marginBottom: 12 }} radius={12} />
            <Skeleton width="100%" height={44} radius={12} />
          </Card>
        </ScrollView>
      </Screen>
    );
  }
  if (!patient) return null;

  return (
    <Screen edges={['bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={{
            padding: t.spacing.s5,
            paddingBottom: t.spacing.s10,
            gap: t.spacing.s4,
          }}
          keyboardShouldPersistTaps="handled"
        >
          {/* Patient card */}
          <Card padding="s5" level={2}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 26,
                  backgroundColor: t.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BodyStrong color="#fff" style={{ fontSize: 18 }}>
                  {(patient.firstName?.[0] ?? '?') + (patient.lastName?.[0] ?? '')}
                </BodyStrong>
              </View>
              <View style={{ flex: 1 }}>
                <H2 numberOfLines={1}>
                  {patient.firstName} {patient.lastName}
                </H2>
                <Caption>
                  {patient.patientCode}
                  {patient.age != null ? ` · ${patient.age}y` : ''}
                  {patient.gender ? ` · ${patient.gender}` : ''}
                  {patient.bloodGroup ? ` · ${patient.bloodGroup}` : ''}
                </Caption>
              </View>
            </View>
            {patient.allergies ? (
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: t.spacing.s2,
                  marginTop: t.spacing.s4,
                  padding: t.spacing.s3,
                  backgroundColor: t.colors.warningTint,
                  borderRadius: t.radius.lg,
                }}
              >
                <Ionicons name="warning" color={t.colors.warning} size={18} />
                <Small color={t.colors.warning} style={{ flex: 1, fontWeight: '600' }}>
                  Allergies: {patient.allergies}
                </Small>
              </View>
            ) : null}
          </Card>

          {/* Ambulance picker */}
          <View>
            <SectionHeader title="Ambulance" />
            {ambulances.length === 0 ? (
              <Card padding="s4">
                <Body color={t.colors.textSecondary}>No ambulance assigned to you.</Body>
              </Card>
            ) : (
              <View style={{ gap: t.spacing.s2 }}>
                {ambulances.map((a) => {
                  const active = selectedAmbId === a.id;
                  return (
                    <Pressable
                      key={a.id}
                      onPress={() => setSelectedAmbId(a.id)}
                    >
                      {({ pressed }) => (
                        <Card
                          padding="s4"
                          style={[
                            active
                              ? {
                                  borderColor: t.colors.primary,
                                  borderWidth: 2,
                                  padding: t.spacing.s4 - 1,
                                }
                              : null,
                            pressed && { opacity: 0.85 },
                          ]}
                        >
                          <View
                            style={{
                              flexDirection: 'row',
                              alignItems: 'center',
                              gap: t.spacing.s3,
                            }}
                          >
                            <View
                              style={{
                                width: 22,
                                height: 22,
                                borderRadius: 11,
                                borderWidth: 2,
                                borderColor: active ? t.colors.primary : t.colors.border,
                                backgroundColor: active ? t.colors.primary : 'transparent',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                            >
                              {active && <Ionicons name="checkmark" size={14} color="#fff" />}
                            </View>
                            <View style={{ flex: 1 }}>
                              <BodyStrong>{a.ambulance_code}</BodyStrong>
                              <Caption>{a.registration_number}</Caption>
                            </View>
                            <Badge
                              label={a.status.replace('_', ' ')}
                              tone={toneForStatus(a.status)}
                            />
                          </View>
                        </Card>
                      )}
                    </Pressable>
                  );
                })}
              </View>
            )}
          </View>

          {/* Destination hospital — required by the backend. Hospital users
              auto-target their own org; fleet users must pick from active
              partnerships. Without this, /patients/:id/onboard returns 400. */}
          <View>
            <SectionHeader title="Destination hospital" />
            {isHospitalContext ? (
              <Card padding="s4">
                <BodyStrong numberOfLines={1}>
                  {orgName ?? 'Your hospital'}
                </BodyStrong>
                <Caption>Destination is automatically set to your hospital.</Caption>
              </Card>
            ) : isFleetContext ? (
              partneredHospitals.length === 0 ? (
                <Card padding="s4">
                  <Body color={t.colors.warning}>
                    No partnered hospitals available. Establish a partnership before onboarding.
                  </Body>
                </Card>
              ) : (
                <View style={{ gap: t.spacing.s2 }}>
                  {partneredHospitals.map((h) => {
                    const active = destinationHospitalId === h.id;
                    return (
                      <Pressable key={h.id} onPress={() => setDestinationHospitalId(h.id)}>
                        {({ pressed }) => (
                          <Card
                            padding="s4"
                            style={[
                              active
                                ? {
                                    borderColor: t.colors.primary,
                                    borderWidth: 2,
                                    padding: t.spacing.s4 - 1,
                                  }
                                : null,
                              pressed && { opacity: 0.85 },
                            ]}
                          >
                            <View
                              style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: t.spacing.s3,
                              }}
                            >
                              <View
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 11,
                                  borderWidth: 2,
                                  borderColor: active ? t.colors.primary : t.colors.border,
                                  backgroundColor: active ? t.colors.primary : 'transparent',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                {active && <Ionicons name="checkmark" size={14} color="#fff" />}
                              </View>
                              <View style={{ flex: 1 }}>
                                <BodyStrong numberOfLines={1}>{h.name}</BodyStrong>
                                {h.code ? <Caption numberOfLines={1}>{h.code}</Caption> : null}
                              </View>
                            </View>
                          </Card>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              )
            ) : (
              <Card padding="s4">
                <Body color={t.colors.textSecondary}>
                  Your account isn&apos;t linked to an organization. Sign in again or pick a viewing-as org.
                </Body>
              </Card>
            )}
          </View>

          {/* Trip details */}
          <Card padding="s5">
            <SectionHeader title="Trip details" />
            <Input
              label="Pickup location"
              value={pickup}
              onChangeText={setPickup}
              placeholder="e.g. 123 Main St"
            />
            <Input
              label="Destination"
              value={destination}
              onChangeText={setDestination}
              placeholder="e.g. ER bay 4"
            />
            <Input
              label="Chief complaint"
              value={complaint}
              onChangeText={setComplaint}
              multiline
              placeholder="What is the primary issue?"
            />
            <Input
              label="Initial assessment"
              value={assessment}
              onChangeText={setAssessment}
              multiline
              placeholder="Observed condition, ABC, vitals…"
            />
          </Card>

          <Button
            label="Onboard patient"
            onPress={onConfirm}
            loading={busy}
            disabled={!selectedAmbId || !destinationHospitalId}
            fullWidth
            size="lg"
            icon={<Ionicons name="checkmark-circle" size={20} color="#fff" />}
            style={{ marginTop: t.spacing.s3 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
