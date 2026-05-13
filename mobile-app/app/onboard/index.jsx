// Onboard step 1 — pick (or create) the patient. Hits /patients/available.

import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  TextInput,
  View,
} from 'react-native';
import { errorMessage } from '../../src/api/client';
import { listAvailablePatients } from '../../src/api/patients';
import { useAuth } from '../../src/store/auth';
import { useTheme } from '../../src/theme';
import {
  BodyStrong,
  Button,
  Card,
  Caption,
  EmptyState,
  OrgPicker,
  OrgPickerEmpty,
  Screen,
} from '../../src/ui';

export default function OnboardIndex() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const activeOrg = useAuth((s) => s.activeOrg);
  const [q, setQ] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

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
        <Button
          label="Create new patient"
          variant="outline"
          icon={<Ionicons name="person-add-outline" color={t.colors.primary} size={18} />}
          onPress={() => router.push('/onboard/new-patient')}
          fullWidth
          disabled={gatedBySuperadminOrg}
        />
      </View>

      {gatedBySuperadminOrg ? (
        <OrgPickerEmpty resource="patients" />
      ) : loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.colors.primary} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{
            paddingHorizontal: t.spacing.s5,
            paddingBottom: t.spacing.s5,
            gap: t.spacing.s3,
          }}
          data={items}
          keyExtractor={(p) => p.id}
          ListEmptyComponent={
            <EmptyState
              icon="people-outline"
              title="No available patients"
              subtitle={err ?? (q ? 'No matches for that search.' : 'Create a new patient to onboard.')}
            />
          }
          renderItem={({ item }) => (
            <Card padding="s4" onPress={() => router.push(`/onboard/${item.id}`)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
                <View
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 22,
                    backgroundColor: t.colors.surfaceAlt,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <BodyStrong>
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
    </Screen>
  );
}
