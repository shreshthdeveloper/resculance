// Step 2 — confirm onboarding. Pick ambulance + trip details, then POST.

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { getMyAmbulances } from '../../src/api/ambulances';
import { errorMessage } from '../../src/api/client';
import { getPatient, onboardPatient } from '../../src/api/patients';
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
  Small,
  toneForStatus,
} from '../../src/ui';

export default function ConfirmOnboardScreen() {
  const t = useTheme();
  const { patientId } = useLocalSearchParams();
  const router = useRouter();

  const [patient, setPatient] = useState(null);
  const [ambulances, setAmbulances] = useState([]);
  const [selectedAmbId, setSelectedAmbId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [complaint, setComplaint] = useState('');
  const [assessment, setAssessment] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [p, ambs] = await Promise.all([
          getPatient(String(patientId)),
          getMyAmbulances(),
        ]);
        setPatient(p);
        const usable = ambs.filter(
          (a) => a.status === 'available' || a.status === 'active',
        );
        setAmbulances(ambs);
        setSelectedAmbId(usable[0]?.id ?? ambs[0]?.id ?? null);
      } catch (e) {
        Alert.alert('Error', errorMessage(e), [
          { text: 'OK', onPress: () => router.back() },
        ]);
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId, router]);

  const onConfirm = async () => {
    if (!selectedAmbId) {
      Alert.alert(
        'No ambulance',
        'You need an assigned ambulance to onboard a patient.',
      );
      return;
    }
    setBusy(true);
    try {
      const r = await onboardPatient(String(patientId), {
        ambulanceId: selectedAmbId,
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
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.colors.primary} />
        </View>
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
            disabled={!selectedAmbId}
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
