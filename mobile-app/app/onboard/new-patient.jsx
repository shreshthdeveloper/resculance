// New-patient form — feeds straight into the onboarding confirm screen.

import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
} from 'react-native';
import { errorMessage } from '../../src/api/client';
import { createPatient } from '../../src/api/patients';
import { useTheme } from '../../src/theme';
import { Button, Card, Input, Screen, SectionHeader } from '../../src/ui';

export default function NewPatientScreen() {
  const t = useTheme();
  const router = useRouter();
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
    const input = {
      firstName: f.firstName.trim(),
      lastName: f.lastName.trim() || undefined,
      age: f.age ? Number(f.age) : undefined,
      gender: f.gender.trim() || undefined,
      bloodGroup: f.bloodGroup.trim() || undefined,
      phone: f.phone.trim() || undefined,
      emergencyContactName: f.emergencyContactName.trim() || undefined,
      emergencyContactPhone: f.emergencyContactPhone.trim() || undefined,
      allergies: f.allergies.trim() || undefined,
      medicalHistory: f.medicalHistory.trim() || undefined,
    };
    setBusy(true);
    try {
      const r = await createPatient(input);
      router.replace(`/onboard/${r.patientId}`);
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
            <View style={{ flexDirection: 'row', gap: t.spacing.s3 }}>
              <View style={{ flex: 1 }}>
                <Input
                  label="Age"
                  value={f.age}
                  onChangeText={(v) => set('age', v)}
                  keyboardType="number-pad"
                  editable={!busy}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Gender"
                  value={f.gender}
                  onChangeText={(v) => set('gender', v)}
                  editable={!busy}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Input
                  label="Blood"
                  value={f.bloodGroup}
                  onChangeText={(v) => set('bloodGroup', v)}
                  editable={!busy}
                />
              </View>
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
