// Patient detail — full demographic + medical record + recent vital history.

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, View } from 'react-native';
import { errorMessage } from '../../src/api/client';
import { getPatient } from '../../src/api/patients';
import { listVitalSigns } from '../../src/api/sessions';
import { useTheme } from '../../src/theme';
import {
  Badge,
  Body,
  BodyStrong,
  Card,
  Caption,
  EmptyState,
  H1,
  H3,
  Screen,
  SectionHeader,
  Small,
  toneForStatus,
} from '../../src/ui';

export default function PatientDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams();
  const patientId = String(id);
  const [patient, setPatient] = useState(null);
  const [vitals, setVitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const [p, vs] = await Promise.all([
          getPatient(patientId),
          listVitalSigns(patientId, 5).catch(() => []),
        ]);
        setPatient(p);
        setVitals(vs);
      } catch (e) {
        setErr(errorMessage(e));
      } finally {
        setLoading(false);
      }
    })();
  }, [patientId]);

  if (loading) {
    return (
      <Screen edges={['bottom']}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.colors.primary} />
        </View>
      </Screen>
    );
  }
  if (err || !patient) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState icon="alert-circle-outline" title="Couldn't load patient" subtitle={err ?? ''} />
      </Screen>
    );
  }

  const initials = (patient.firstName?.[0] ?? '?') + (patient.lastName?.[0] ?? '');

  return (
    <Screen edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s4 }}>
        {/* Hero card */}
        <Card padding="s6" level={2}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s4 }}>
            <View
              style={{
                width: 64,
                height: 64,
                borderRadius: 32,
                backgroundColor: t.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <BodyStrong color="#fff" style={{ fontSize: 22 }}>
                {initials}
              </BodyStrong>
            </View>
            <View style={{ flex: 1 }}>
              <H1 style={{ fontSize: 22 }} numberOfLines={2}>
                {patient.firstName} {patient.lastName}
              </H1>
              <Caption style={{ marginTop: 2 }}>{patient.patientCode}</Caption>
            </View>
            <Badge
              label={patient.status}
              tone={toneForStatus(patient.status)}
            />
          </View>

          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              gap: t.spacing.s2,
              marginTop: t.spacing.s4,
            }}
          >
            {patient.age != null ? <Badge label={`${patient.age} years`} tone="neutral" /> : null}
            {patient.gender ? <Badge label={patient.gender} tone="neutral" /> : null}
            {patient.bloodGroup ? <Badge label={`Blood ${patient.bloodGroup}`} tone="danger" /> : null}
            {patient.latestSessionStatus ? (
              <Badge
                label={`Session ${patient.latestSessionStatus.replace('_', ' ')}`}
                tone={toneForStatus(patient.latestSessionStatus)}
              />
            ) : null}
          </View>
        </Card>

        {/* Allergies warning */}
        {patient.allergies ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: t.spacing.s3,
              backgroundColor: t.colors.warningTint,
              padding: t.spacing.s4,
              borderRadius: t.radius.xl,
              borderLeftWidth: 4,
              borderLeftColor: t.colors.warning,
            }}
          >
            <Ionicons name="warning" color={t.colors.warning} size={20} />
            <View style={{ flex: 1 }}>
              <BodyStrong color={t.colors.warning}>Allergies</BodyStrong>
              <Body color={t.colors.text} style={{ marginTop: 2 }}>
                {patient.allergies}
              </Body>
            </View>
          </View>
        ) : null}

        {/* Contact */}
        <Card padding="s5">
          <SectionHeader title="Contact" />
          {patient.phone ? (
            <ContactRow
              icon="call-outline"
              label="Phone"
              value={patient.phone}
              onPress={() => Linking.openURL(`tel:${patient.phone}`)}
            />
          ) : (
            <Caption>No phone on file</Caption>
          )}
          {patient.email ? (
            <ContactRow
              icon="mail-outline"
              label="Email"
              value={patient.email}
              onPress={() => Linking.openURL(`mailto:${patient.email}`)}
            />
          ) : null}
          {patient.address ? (
            <ContactRow icon="location-outline" label="Address" value={patient.address} />
          ) : null}
        </Card>

        {/* Emergency contact */}
        {patient.emergencyContactName || patient.emergencyContactPhone ? (
          <Card padding="s5">
            <SectionHeader title="Emergency contact" />
            {patient.emergencyContactName ? (
              <Body>{patient.emergencyContactName}</Body>
            ) : null}
            {patient.emergencyContactRelation ? (
              <Caption>{patient.emergencyContactRelation}</Caption>
            ) : null}
            {patient.emergencyContactPhone ? (
              <Pressable
                onPress={() => Linking.openURL(`tel:${patient.emergencyContactPhone}`)}
                style={{ marginTop: t.spacing.s2 }}
              >
                <Body color={t.colors.primary} style={{ fontWeight: '600' }}>
                  {patient.emergencyContactPhone}
                </Body>
              </Pressable>
            ) : null}
          </Card>
        ) : null}

        {/* Medical */}
        {(patient.medicalHistory || patient.currentMedications) ? (
          <Card padding="s5">
            <SectionHeader title="Medical" />
            {patient.medicalHistory ? (
              <View style={{ marginBottom: t.spacing.s3 }}>
                <Caption>History</Caption>
                <Body style={{ marginTop: 2 }}>{patient.medicalHistory}</Body>
              </View>
            ) : null}
            {patient.currentMedications ? (
              <View>
                <Caption>Current medications</Caption>
                <Body style={{ marginTop: 2 }}>{patient.currentMedications}</Body>
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* Recent vitals */}
        <Card padding="s5">
          <SectionHeader title="Recent vitals" />
          {vitals.length === 0 ? (
            <Caption>No vitals recorded yet.</Caption>
          ) : (
            vitals.map((v) => (
              <View
                key={v._id}
                style={{
                  paddingVertical: t.spacing.s3,
                  borderBottomWidth: 1,
                  borderBottomColor: t.colors.border,
                }}
              >
                <Caption>{new Date(v.recorded_at).toLocaleString()}</Caption>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s4, marginTop: 6 }}>
                  {v.heart_rate != null && <VitalCell label="HR" value={`${v.heart_rate}`} />}
                  {v.blood_pressure_systolic && v.blood_pressure_diastolic ? (
                    <VitalCell label="BP" value={`${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}`} />
                  ) : null}
                  {v.temperature != null && <VitalCell label="Temp" value={`${v.temperature}°`} />}
                  {v.oxygen_saturation != null && <VitalCell label="SpO₂" value={`${v.oxygen_saturation}%`} />}
                </View>
              </View>
            ))
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function ContactRow({ icon, label, value, onPress }) {
  const t = useTheme();
  const inner = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.s3,
        paddingVertical: t.spacing.s2,
      }}
    >
      <Ionicons name={icon} size={18} color={t.colors.textMuted} />
      <View style={{ flex: 1 }}>
        <Caption>{label}</Caption>
        <Body color={onPress ? t.colors.primary : t.colors.text}>{value}</Body>
      </View>
      {onPress ? <Ionicons name="chevron-forward" size={16} color={t.colors.textMuted} /> : null}
    </View>
  );
  return onPress ? (
    <Pressable onPress={onPress}>{({ pressed }) => <View style={pressed && { opacity: 0.5 }}>{inner}</View>}</Pressable>
  ) : (
    inner
  );
}

function VitalCell({ label, value }) {
  const t = useTheme();
  return (
    <View>
      <Caption>{label}</Caption>
      <H3 style={{ fontSize: 18 }}>{value}</H3>
    </View>
  );
}
