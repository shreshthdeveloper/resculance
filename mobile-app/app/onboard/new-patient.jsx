// New-patient form — feeds straight into the onboarding confirm screen.

import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { errorMessage } from '../../src/api/client';
import { createPatient } from '../../src/api/patients';
import { useTheme } from '../../src/theme';
import { Body, Button, Card, Caption, Input, Screen, SectionHeader } from '../../src/ui';

// Backend schema enums — keep these aligned with backend/src/models/Patient.js.
// Sending anything else trips the Mongoose validator and the user sees a
// 500 instead of a helpful field error, so we restrict input to picker values.
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function NewPatientScreen() {
  const t = useTheme();
  const router = useRouter();
  // Forwarded from /onboard?ambulanceId=… so the confirm step pre-picks.
  const { ambulanceId } = useLocalSearchParams();
  const [f, setF] = useState({
    firstName: '',
    lastName: '',
    age: '',
    gender: '',
    bloodGroup: '',
    phone: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    allergies: '',
    medicalHistory: '',
  });
  const [busy, setBusy] = useState(false);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const onSave = async () => {
    if (!f.firstName.trim()) {
      Alert.alert('Required', 'First name is required.');
      return;
    }
    if (f.age) {
      const ageNum = Number(f.age);
      if (Number.isNaN(ageNum) || ageNum < 0 || ageNum > 150) {
        Alert.alert('Invalid age', 'Age must be a number between 0 and 150.');
        return;
      }
    }
    const input = {
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim() || undefined,
      age: f.age ? Number(f.age) : undefined,
      // Gender + blood group are schema-enforced enums; only send a value
      // when one was picked.
      gender: f.gender || undefined,
      bloodGroup: f.bloodGroup || undefined,
      phone: f.phone.trim() || undefined,
      emergencyContactName: f.emergencyContactName.trim() || undefined,
      emergencyContactPhone: f.emergencyContactPhone.trim() || undefined,
      allergies: f.allergies.trim() || undefined,
      medicalHistory: f.medicalHistory.trim() || undefined,
    };
    setBusy(true);
    try {
      const r = await createPatient(input);
      router.replace({
        pathname: `/onboard/${r.patientId}`,
        params: ambulanceId ? { ambulanceId } : undefined,
      });
    } catch (e) {
      Alert.alert('Save failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

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
          }}
          keyboardShouldPersistTaps="handled"
        >
          <Card padding="s5">
            <SectionHeader title="Basic info" />
            <Input
              label="First name *"
              value={f.firstName}
              onChangeText={(v) => set('firstName', v)}
              editable={!busy}
            />
            <Input
              label="Last name"
              value={f.lastName}
              onChangeText={(v) => set('lastName', v)}
              editable={!busy}
            />
            <Input
              label="Age"
              value={f.age}
              onChangeText={(v) => set('age', v)}
              keyboardType="number-pad"
              editable={!busy}
              placeholder="0–150"
            />
            <Caption style={{ marginBottom: t.spacing.s2 }}>Gender</Caption>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2, marginBottom: t.spacing.s4 }}>
              {GENDERS.map((g) => (
                <Pill
                  key={g.value}
                  label={g.label}
                  active={f.gender === g.value}
                  onPress={() => !busy && set('gender', f.gender === g.value ? '' : g.value)}
                />
              ))}
            </View>
            <Caption style={{ marginBottom: t.spacing.s2 }}>Blood group</Caption>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
              {BLOOD_GROUPS.map((bg) => (
                <Pill
                  key={bg}
                  label={bg}
                  active={f.bloodGroup === bg}
                  onPress={() => !busy && set('bloodGroup', f.bloodGroup === bg ? '' : bg)}
                />
              ))}
            </View>
          </Card>

          <Card padding="s5" style={{ marginTop: t.spacing.s4 }}>
            <SectionHeader title="Contact" />
            <Input
              label="Phone"
              value={f.phone}
              onChangeText={(v) => set('phone', v)}
              keyboardType="phone-pad"
              editable={!busy}
            />
            <Input
              label="Emergency contact name"
              value={f.emergencyContactName}
              onChangeText={(v) => set('emergencyContactName', v)}
              editable={!busy}
            />
            <Input
              label="Emergency contact phone"
              value={f.emergencyContactPhone}
              onChangeText={(v) => set('emergencyContactPhone', v)}
              keyboardType="phone-pad"
              editable={!busy}
            />
          </Card>

          <Card padding="s5" style={{ marginTop: t.spacing.s4 }}>
            <SectionHeader title="Medical" />
            <Input
              label="Allergies"
              value={f.allergies}
              onChangeText={(v) => set('allergies', v)}
              multiline
              editable={!busy}
            />
            <Input
              label="Medical history"
              value={f.medicalHistory}
              onChangeText={(v) => set('medicalHistory', v)}
              multiline
              editable={!busy}
            />
          </Card>

          <Button
            label="Save & continue"
            onPress={onSave}
            loading={busy}
            fullWidth
            size="lg"
            style={{ marginTop: t.spacing.s5 }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

// Local Pill matches the styling used on the ambulance form and elsewhere —
// kept local so this screen doesn't pull in another shared dep just for it.
function Pill({ label, active, onPress }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          paddingHorizontal: t.spacing.s4,
          paddingVertical: t.spacing.s2 + 2,
          borderRadius: t.radius.pill,
          backgroundColor: active ? t.colors.primary : t.colors.surfaceAlt,
          borderWidth: 1,
          borderColor: active ? t.colors.primary : t.colors.border,
        },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Body color={active ? '#fff' : t.colors.text} style={{ fontWeight: '600', fontSize: 13 }}>
        {label}
      </Body>
    </Pressable>
  );
}
