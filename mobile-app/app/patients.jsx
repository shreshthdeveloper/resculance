// Patients management — searchable patient list with status filters,
// edit + archive/restore actions, and a "New patient" CTA that flows into
// the onboarding screen.
//
// Mounted on the root Stack (not a tab). Reachable from Home quick-actions
// and from Profile.

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '../src/api/client';
import {
  activatePatient,
  archivePatient,
  listPatients,
  updatePatient,
} from '../src/api/patients';
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
  Input,
  OrgPicker,
  OrgPickerEmpty,
  Screen,
  SkeletonRow,
  Small,
  toneForStatus,
} from '../src/ui';

const STATUS_FILTERS = [
  { value: 'active', label: 'Active' },
  { value: 'all', label: 'All' },
  { value: 'inactive', label: 'Archived' },
];

// Backend Patient model restricts gender to ['male','female','other'] and
// blood_group to the 8 standard ABO/Rh values. Keep these in sync so the
// picker can never send a non-enum value that Mongoose rejects.
const GENDERS = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function PatientsScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const activeOrg = useAuth((s) => s.activeOrg);

  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [filter, setFilter] = useState('active');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(null);

  const isSuperadmin = user?.role === 'superadmin';
  const gatedBySuperadminOrg = isSuperadmin && !activeOrg;

  const load = useCallback(async (search = '', f = 'active') => {
    setErr(null);
    if (gatedBySuperadminOrg) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const params = { limit: 200 };
      if (search) params.search = search;
      // The list endpoint returns active-only by default; passing
      // includeInactive=true flips that. We re-filter client-side for the
      // 'inactive' bucket since the backend doesn't expose a status filter
      // on /patients (only on the model — see patientController.getAll).
      if (f !== 'active') params.includeInactive = true;
      const r = await listPatients(params);
      let rows = r.patients ?? [];
      if (f === 'inactive') rows = rows.filter((p) => p.status !== 'active');
      setItems(rows);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [gatedBySuperadminOrg]);

  useFocusEffect(useCallback(() => { load(q, filter); }, [load, q, filter]));

  // Debounced search.
  useEffect(() => {
    const id = setTimeout(() => load(q, filter), 300);
    return () => clearTimeout(id);
  }, [q, filter, load]);

  useEffect(() => {
    if (!isSuperadmin) return;
    setLoading(!gatedBySuperadminOrg);
    load(q, filter);
  }, [activeOrg?.id, isSuperadmin, gatedBySuperadminOrg, load, q, filter]);

  const onArchive = (p) => {
    Alert.alert(
      'Archive patient?',
      `${p.firstName} ${p.lastName ?? ''}'s record will be hidden from the active list. You can restore later.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Archive',
          style: 'destructive',
          onPress: async () => {
            try {
              await archivePatient(p.id);
              load(q, filter);
            } catch (e) {
              Alert.alert('Failed', errorMessage(e));
            }
          },
        },
      ],
    );
  };

  const onRestore = (p) => {
    (async () => {
      try {
        await activatePatient(p.id);
        load(q, filter);
      } catch (e) {
        Alert.alert('Failed', errorMessage(e));
      }
    })();
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ padding: t.spacing.s5, paddingBottom: t.spacing.s3, gap: t.spacing.s3 }}>
        {isSuperadmin ? <OrgPicker /> : null}

        {/* Search */}
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
            placeholder="Search name, code, phone…"
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

        {/* Status filter */}
        <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
          {STATUS_FILTERS.map((s) => {
            const active = filter === s.value;
            return (
              <Pressable
                key={s.value}
                onPress={() => setFilter(s.value)}
                style={({ pressed }) => [
                  {
                    paddingHorizontal: t.spacing.s4,
                    paddingVertical: t.spacing.s2,
                    borderRadius: t.radius.pill,
                    backgroundColor: active ? t.colors.primary : t.colors.surfaceAlt,
                  },
                  pressed && { opacity: 0.75 },
                ]}
              >
                <Small
                  color={active ? '#fff' : t.colors.textSecondary}
                  style={{ fontWeight: '600' }}
                >
                  {s.label}
                </Small>
              </Pressable>
            );
          })}
        </View>
      </View>

      {gatedBySuperadminOrg ? (
        <OrgPickerEmpty resource="patients" />
      ) : (
        <FlatList
          contentContainerStyle={{
            paddingHorizontal: t.spacing.s5,
            paddingBottom: t.spacing.s12,
            gap: t.spacing.s3,
          }}
          data={loading ? [] : items}
          keyExtractor={(p) => p.id}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => {
                setRefreshing(true);
                load(q, filter);
              }}
              tintColor={t.colors.primary}
              colors={[t.colors.primary]}
            />
          }
          ListEmptyComponent={
            loading ? (
              <View style={{ gap: t.spacing.s3 }}>
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
                <SkeletonRow />
              </View>
            ) : (
              <EmptyState
                icon="people-outline"
                title={filter === 'inactive' ? 'No archived patients' : 'No patients'}
                subtitle={
                  err ??
                  (q
                    ? 'No matches for that search.'
                    : 'Create a new patient to start onboarding.')
                }
                action={
                  <Button
                    label="New patient"
                    icon={<Ionicons name="person-add" color="#fff" size={18} />}
                    onPress={() => router.push('/onboard/new-patient')}
                  />
                }
              />
            )
          }
          renderItem={({ item }) => (
            <PatientRow
              p={item}
              onOpen={() => router.push(`/patient/${item.id}`)}
              onEdit={() => setEditing(item)}
              onArchive={() => onArchive(item)}
              onRestore={() => onRestore(item)}
            />
          )}
        />
      )}

      <Pressable
        onPress={() => router.push('/onboard/new-patient')}
        style={({ pressed }) => [
          {
            position: 'absolute',
            right: t.spacing.s5,
            bottom: t.spacing.s5,
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: t.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: t.colors.primary,
            shadowOpacity: 0.35,
            shadowRadius: 12,
            shadowOffset: { width: 0, height: 6 },
            elevation: 6,
          },
          pressed && { transform: [{ scale: 0.94 }] },
        ]}
      >
        <Ionicons name="person-add" size={24} color="#fff" />
      </Pressable>

      <EditPatientModal
        patient={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load(q, filter);
        }}
      />
    </Screen>
  );
}

function PatientRow({ p, onOpen, onEdit, onArchive, onRestore }) {
  const t = useTheme();
  const isInactive = p.status !== 'active';
  return (
    <Card onPress={onOpen} padding="s4" style={isInactive ? { opacity: 0.7 } : null}>
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
          <BodyStrong color={t.colors.primary}>
            {(p.firstName?.[0] ?? '?') + (p.lastName?.[0] ?? '')}
          </BodyStrong>
        </View>
        <View style={{ flex: 1 }}>
          <BodyStrong numberOfLines={1}>
            {p.firstName} {p.lastName}
          </BodyStrong>
          <Caption numberOfLines={1}>
            {p.patientCode}
            {p.age != null ? ` · ${p.age}y` : ''}
            {p.gender ? ` · ${p.gender}` : ''}
            {p.bloodGroup ? ` · ${p.bloodGroup}` : ''}
          </Caption>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Badge label={p.status} tone={toneForStatus(p.status)} />
          {p.latestSessionStatus ? (
            <Caption>{p.latestSessionStatus.replace('_', ' ')}</Caption>
          ) : null}
        </View>
      </View>

      <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s3 }}>
        <Button label="View" variant="secondary" size="sm" onPress={onOpen} style={{ flex: 1 }} />
        <Button label="Edit" variant="secondary" size="sm" onPress={onEdit} style={{ flex: 1 }} />
        {isInactive ? (
          <Button label="Restore" variant="outline" size="sm" onPress={onRestore} style={{ flex: 1 }} />
        ) : (
          <Button label="Archive" variant="outline" size="sm" onPress={onArchive} style={{ flex: 1 }} />
        )}
      </View>
    </Card>
  );
}

function EditPatientModal({ patient, onClose, onSaved }) {
  const t = useTheme();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);

  // Seed form whenever the patient changes (modal opens with a different
  // record).
  useEffect(() => {
    if (!patient) return;
    setF({
      firstName: patient.firstName ?? '',
      lastName: patient.lastName ?? '',
      age: patient.age != null ? String(patient.age) : '',
      gender: patient.gender ?? '',
      bloodGroup: patient.bloodGroup ?? '',
      phone: patient.phone ?? '',
      email: patient.email ?? '',
      allergies: patient.allergies ?? '',
      medicalHistory: patient.medicalHistory ?? '',
      currentMedications: patient.currentMedications ?? '',
      emergencyContactName: patient.emergencyContactName ?? '',
      emergencyContactPhone: patient.emergencyContactPhone ?? '',
    });
  }, [patient]);

  if (!patient) return (
    <Modal visible={false} transparent>
      <View />
    </Modal>
  );

  const submit = async () => {
    const patch = {};
    for (const k of Object.keys(f)) {
      const v = typeof f[k] === 'string' ? f[k].trim() : f[k];
      if (k === 'age') {
        const n = v === '' ? null : Number(v);
        if (n !== patient.age && !(v === '' && patient.age == null)) {
          patch.age = n;
        }
      } else if ((v || '') !== (patient[k] ?? '')) {
        patch[k] = v || undefined;
      }
    }
    if (Object.keys(patch).length === 0) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await updatePatient(patient.id, patch);
      onSaved();
    } catch (e) {
      Alert.alert('Save failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  return (
    <Modal
      visible={!!patient}
      animationType="slide"
      presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }} edges={['top', 'bottom']}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: t.spacing.s4,
            borderBottomWidth: 1,
            borderBottomColor: t.colors.border,
            backgroundColor: t.colors.card,
          }}
        >
          <Pressable onPress={onClose} hitSlop={8}>
            <Body color={t.colors.textSecondary}>Cancel</Body>
          </Pressable>
          <H3 numberOfLines={1}>Edit patient</H3>
          <Pressable onPress={submit} hitSlop={8} disabled={busy}>
            <Body color={t.colors.primary} style={{ fontWeight: '700', opacity: busy ? 0.5 : 1 }}>
              Save
            </Body>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: t.spacing.s5 }}>
          <Card padding="s5">
            <Input label="First name" value={f.firstName} onChangeText={(v) => set('firstName', v)} />
            <Input label="Last name" value={f.lastName} onChangeText={(v) => set('lastName', v)} />
            <Input label="Age" value={f.age} onChangeText={(v) => set('age', v)} keyboardType="number-pad" placeholder="0–150" />
            <Caption style={{ marginBottom: t.spacing.s2 }}>Gender</Caption>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2, marginBottom: t.spacing.s4 }}>
              {GENDERS.map((g) => (
                <Pill
                  key={g.value}
                  label={g.label}
                  active={f.gender === g.value}
                  onPress={() => set('gender', f.gender === g.value ? '' : g.value)}
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
                  onPress={() => set('bloodGroup', f.bloodGroup === bg ? '' : bg)}
                />
              ))}
            </View>
          </Card>
          <Card padding="s5" style={{ marginTop: t.spacing.s4 }}>
            <Input label="Phone" value={f.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
            <Input label="Email" value={f.email} onChangeText={(v) => set('email', v)} keyboardType="email-address" autoCapitalize="none" />
            <Input label="Emergency contact name" value={f.emergencyContactName} onChangeText={(v) => set('emergencyContactName', v)} />
            <Input
              label="Emergency contact phone"
              value={f.emergencyContactPhone}
              onChangeText={(v) => set('emergencyContactPhone', v)}
              keyboardType="phone-pad"
            />
          </Card>
          <Card padding="s5" style={{ marginTop: t.spacing.s4 }}>
            <Input label="Allergies" value={f.allergies} onChangeText={(v) => set('allergies', v)} multiline />
            <Input label="Medical history" value={f.medicalHistory} onChangeText={(v) => set('medicalHistory', v)} multiline />
            <Input
              label="Current medications"
              value={f.currentMedications}
              onChangeText={(v) => set('currentMedications', v)}
              multiline
            />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

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
