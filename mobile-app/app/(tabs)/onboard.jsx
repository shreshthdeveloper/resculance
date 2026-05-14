// Onboard step 1 — pick (or create) the patient. Hits /patients/available.
// Three ways in:
//   1. Type a name → debounced search of /patients/available.
//   2. Tap the QR-style shortcut → enter a patient code → look up via
//      /patients/code/:code (skips the search entirely).
//   3. "Create new patient" → /onboard/new-patient.

import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Platform,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '../../src/api/client';
import {
  getPatientByCode,
  listAvailablePatients,
} from '../../src/api/patients';
import { useAuth } from '../../src/store/auth';
import { useTheme } from '../../src/theme';
import {
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
} from '../../src/ui';

export default function OnboardIndex() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const activeOrg = useAuth((s) => s.activeOrg);
  // Optional pre-pick: when arriving from /onboardings (the ambulance-
  // centric onboarding list), the ambulance is already known. We forward
  // it through every transition so the confirm step can pre-select.
  const { ambulanceId } = useLocalSearchParams();
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [codeModal, setCodeModal] = useState(false);
  const [code, setCode] = useState('');
  const [codeBusy, setCodeBusy] = useState(false);

  const isSuperadmin = user?.role === 'superadmin';
  const gatedBySuperadminOrg = isSuperadmin && !activeOrg;

  const load = useCallback(async (search = '') => {
    setErr(null);
    if (gatedBySuperadminOrg) {
      setItems([]);
      setLoading(false);
      return;
    }
    try {
      const r = await listAvailablePatients({ search, limit: 100 });
      setItems(r.patients);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [gatedBySuperadminOrg]);

  useEffect(() => { load(''); }, [load]);

  // Debounced search.
  useEffect(() => {
    const id = setTimeout(() => load(q), 300);
    return () => clearTimeout(id);
  }, [q, load]);

  // Re-fetch when the superadmin switches "viewing as" org.
  useEffect(() => {
    if (!isSuperadmin) return;
    setLoading(!gatedBySuperadminOrg);
    load(q);
  }, [activeOrg?.id, isSuperadmin, gatedBySuperadminOrg, load, q]);

  const lookupCode = async () => {
    // Patient codes are generated server-side as `PAT-XXXXXX` (uppercase) and
    // matched case-sensitively on the backend. Normalise here so a user
    // who types `pat-abc123` on a keyboard that didn't capitalise (Android
    // numeric/email keyboards often don't) still gets a hit instead of 404.
    const c = code.trim().toUpperCase();
    if (!c) return;
    setCodeBusy(true);
    try {
      const p = await getPatientByCode(c);
      const pid = p?.id ?? p?._id;
      if (!pid) throw new Error('Patient not found');
      setCodeModal(false);
      setCode('');
      router.push({
        pathname: `/onboard/${pid}`,
        params: ambulanceId ? { ambulanceId } : undefined,
      });
    } catch (e) {
      Alert.alert('Lookup failed', errorMessage(e));
    } finally {
      setCodeBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ padding: t.spacing.s5, gap: t.spacing.s3 }}>
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
            placeholder="Search by name or code…"
            placeholderTextColor={t.colors.textMuted}
            autoCorrect={false}
            editable={!gatedBySuperadminOrg}
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

        {/* Two CTAs side-by-side: code lookup, and new patient. */}
        <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
          <Button
            label="Enter code"
            variant="secondary"
            icon={<Ionicons name="qr-code-outline" color={t.colors.text} size={18} />}
            onPress={() => setCodeModal(true)}
            style={{ flex: 1 }}
            disabled={gatedBySuperadminOrg}
          />
          <Button
            label="New patient"
            icon={<Ionicons name="person-add-outline" color="#fff" size={18} />}
            onPress={() =>
              router.push({
                pathname: '/onboard/new-patient',
                params: ambulanceId ? { ambulanceId } : undefined,
              })
            }
            style={{ flex: 1 }}
            disabled={gatedBySuperadminOrg}
          />
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
                title="No available patients"
                subtitle={err ?? (q ? 'No matches for that search.' : 'Create a new patient to onboard.')}
                action={
                  <Button
                    label="New patient"
                    icon={<Ionicons name="person-add" color="#fff" size={18} />}
                    onPress={() =>
              router.push({
                pathname: '/onboard/new-patient',
                params: ambulanceId ? { ambulanceId } : undefined,
              })
            }
                  />
                }
              />
            )
          }
          renderItem={({ item }) => (
            <Card
              padding="s4"
              onPress={() =>
                router.push({
                  pathname: `/onboard/${item.id}`,
                  params: ambulanceId ? { ambulanceId } : undefined,
                })
              }
            >
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
                    {(item.firstName?.[0] ?? '?') + (item.lastName?.[0] ?? '')}
                  </BodyStrong>
                </View>
                <View style={{ flex: 1 }}>
                  <BodyStrong>
                    {item.firstName} {item.lastName}
                  </BodyStrong>
                  <Caption>
                    {item.patientCode}
                    {item.age != null ? ` · ${item.age}y` : ''}
                    {item.gender ? ` · ${item.gender}` : ''}
                    {item.bloodGroup ? ` · ${item.bloodGroup}` : ''}
                  </Caption>
                </View>
                <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
              </View>
            </Card>
          )}
        />
      )}

      {/* Patient-code lookup modal. Short, focused: one field, one action. */}
      <Modal
        visible={codeModal}
        animationType="slide"
        presentationStyle={Platform.OS === 'ios' ? 'pageSheet' : 'fullScreen'}
        onRequestClose={() => setCodeModal(false)}
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
            <Pressable onPress={() => setCodeModal(false)} hitSlop={8}>
              <Body color={t.colors.textSecondary}>Cancel</Body>
            </Pressable>
            <H3>Patient code</H3>
            <Pressable onPress={lookupCode} hitSlop={8} disabled={codeBusy || !code.trim()}>
              <Body
                color={t.colors.primary}
                style={{ fontWeight: '700', opacity: codeBusy || !code.trim() ? 0.4 : 1 }}
              >
                Find
              </Body>
            </Pressable>
          </View>
          <View style={{ padding: t.spacing.s5 }}>
            <Card padding="s5">
              <Body style={{ marginBottom: t.spacing.s3 }} color={t.colors.textSecondary}>
                Enter the patient code printed on the wristband or referral form.
              </Body>
              <Input
                label="Code"
                value={code}
                onChangeText={setCode}
                placeholder="e.g. PT-12345"
                autoCapitalize="characters"
                autoCorrect={false}
                autoFocus
                onSubmitEditing={lookupCode}
              />
              <Small>We&apos;ll look it up across all patients you can access.</Small>
            </Card>
          </View>
        </SafeAreaView>
      </Modal>
    </Screen>
  );
}
