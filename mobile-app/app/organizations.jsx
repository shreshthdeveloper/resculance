// Organizations management — superadmin only. List by status (active /
// suspended / inactive), with create + edit + lifecycle actions
// (activate / suspend / deactivate). Non-superadmins shouldn't reach this
// route; we gate the screen content if they do.

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
  activateOrganization,
  createOrganization,
  deactivateOrganization,
  listOrganizations,
  suspendOrganization,
  updateOrganization,
} from '../src/api/organizations';
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
  Screen,
  SkeletonRow,
  Small,
  toneForStatus,
} from '../src/ui';

const STATUS_TABS = [
  { value: 'active', label: 'Active' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
];
const TYPE_TABS = [
  { value: '', label: 'All types' },
  { value: 'hospital', label: 'Hospitals' },
  { value: 'fleet_owner', label: 'Fleets' },
];

export default function OrganizationsScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [type, setType] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const isSuperadmin = user?.role === 'superadmin';

  const load = useCallback(async () => {
    setErr(null);
    if (!isSuperadmin) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const list = await listOrganizations({ status, type: type || undefined, limit: 200, search: q || undefined });
      setItems(list);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, type, q, isSuperadmin]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Debounce search.
  useEffect(() => {
    const id = setTimeout(() => load(), 300);
    return () => clearTimeout(id);
  }, [q, load]);

  if (!isSuperadmin) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="lock-closed-outline"
          title="Superadmin only"
          subtitle="Organization management is restricted to system administrators."
          action={<Button label="Go back" variant="secondary" onPress={() => router.back()} />}
        />
      </Screen>
    );
  }

  const onLifecycle = (org, action) => {
    const verb =
      action === 'suspend' ? 'Suspend'
      : action === 'deactivate' ? 'Deactivate'
      : 'Activate';
    Alert.alert(
      `${verb} ${org.name}?`,
      action === 'deactivate'
        ? 'This stops all org activity. Existing data is preserved; you can activate again later.'
        : action === 'suspend'
        ? 'The org will be temporarily blocked from signing in.'
        : 'Restore this organization.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: verb,
          style: action === 'activate' ? 'default' : 'destructive',
          onPress: async () => {
            try {
              if (action === 'suspend') await suspendOrganization(org.id);
              else if (action === 'deactivate') await deactivateOrganization(org.id);
              else await activateOrganization(org.id);
              load();
            } catch (e) {
              Alert.alert('Failed', errorMessage(e));
            }
          },
        },
      ],
    );
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ padding: t.spacing.s5, paddingBottom: t.spacing.s3, gap: t.spacing.s3 }}>
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
          }}
        >
          <Ionicons name="search" size={18} color={t.colors.textMuted} />
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search by name or code…"
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

        {/* Status pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
            {STATUS_TABS.map((s) => (
              <Pill key={s.value} label={s.label} active={status === s.value} onPress={() => setStatus(s.value)} />
            ))}
            <View style={{ width: 1, backgroundColor: t.colors.border, marginHorizontal: t.spacing.s2 }} />
            {TYPE_TABS.map((ty) => (
              <Pill
                key={ty.value || 'all'}
                label={ty.label}
                active={type === ty.value}
                onPress={() => setType(ty.value)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      <FlatList
        contentContainerStyle={{
          paddingHorizontal: t.spacing.s5,
          paddingBottom: t.spacing.s12,
          gap: t.spacing.s3,
        }}
        data={loading ? [] : items}
        keyExtractor={(o) => o.id}
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
        ListEmptyComponent={
          loading ? (
            <View style={{ gap: t.spacing.s3 }}>
              <SkeletonRow />
              <SkeletonRow />
              <SkeletonRow />
            </View>
          ) : (
            <EmptyState
              icon="business-outline"
              title="No organizations"
              subtitle={err ?? 'Adjust the filters or create one.'}
              action={
                <Button
                  label="New organization"
                  icon={<Ionicons name="add" color="#fff" size={18} />}
                  onPress={() => setCreating(true)}
                />
              }
            />
          )
        }
        renderItem={({ item }) => (
          <OrgRow
            o={item}
            onEdit={() => setEditing(item)}
            onSuspend={() => onLifecycle(item, 'suspend')}
            onDeactivate={() => onLifecycle(item, 'deactivate')}
            onActivate={() => onLifecycle(item, 'activate')}
          />
        )}
      />

      <Pressable
        onPress={() => setCreating(true)}
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
        <Ionicons name="add" size={28} color="#fff" />
      </Pressable>

      <OrgFormModal
        mode="create"
        visible={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          load();
        }}
      />
      <OrgFormModal
        mode="edit"
        org={editing}
        visible={!!editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    </Screen>
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
        {label}
      </Small>
    </Pressable>
  );
}

function OrgRow({ o, onEdit, onSuspend, onDeactivate, onActivate }) {
  const t = useTheme();
  const isActive = o.status === 'active';
  return (
    <Card padding="s5">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
        <View
          style={{
            width: 44,
            height: 44,
            borderRadius: 12,
            backgroundColor: t.colors.primaryTint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons
            name={o.type === 'hospital' ? 'medkit' : 'car-sport'}
            color={t.colors.primary}
            size={20}
          />
        </View>
        <View style={{ flex: 1 }}>
          <BodyStrong numberOfLines={1}>{o.name}</BodyStrong>
          <Caption numberOfLines={1}>
            {o.code} · {o.type?.replace('_', ' ') ?? '—'}
          </Caption>
        </View>
        <Badge label={o.status?.replace('_', ' ') ?? '—'} tone={toneForStatus(o.status)} dot />
      </View>

      <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s4 }}>
        <Button label="Edit" variant="secondary" size="sm" onPress={onEdit} style={{ flex: 1 }} />
        {isActive ? (
          <>
            <Button label="Suspend" variant="outline" size="sm" onPress={onSuspend} style={{ flex: 1 }} />
            <Button label="Deactivate" variant="danger" size="sm" onPress={onDeactivate} style={{ flex: 1 }} />
          </>
        ) : (
          <Button label="Activate" variant="success" size="sm" onPress={onActivate} style={{ flex: 1 }} />
        )}
      </View>
    </Card>
  );
}

function OrgFormModal({ mode, org, visible, onClose, onSaved }) {
  const t = useTheme();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && org) {
      setF({
        name: org.name ?? '',
        code: org.code ?? '',
        type: org.type ?? 'hospital',
        email: org.email ?? '',
        phone: org.phone ?? '',
        address: org.address ?? '',
        city: org.city ?? '',
        state: org.state ?? '',
        country: org.country ?? '',
        postalCode: org.postalCode ?? '',
        registrationNumber: org.registrationNumber ?? '',
        licenseNumber: org.licenseNumber ?? '',
      });
    } else {
      setF({
        name: '',
        code: '',
        type: 'hospital',
        email: '',
        phone: '',
        address: '',
        city: '',
        state: '',
        country: '',
        postalCode: '',
        registrationNumber: '',
        licenseNumber: '',
      });
    }
  }, [visible, mode, org]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.name?.trim()) {
      Alert.alert('Required', 'Name is required.');
      return;
    }
    if (!f.email?.trim()) {
      Alert.alert('Required', 'Email is required.');
      return;
    }
    setBusy(true);
    try {
      const payload = Object.fromEntries(
        Object.entries(f)
          .filter(([, v]) => typeof v === 'string' && v.trim() !== '')
          .map(([k, v]) => [k, v.trim()]),
      );
      if (mode === 'edit' && org) {
        await updateOrganization(org.id, payload);
      } else {
        await createOrganization(payload);
      }
      onSaved();
    } catch (e) {
      Alert.alert('Failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible={visible}
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
          <H3>{mode === 'edit' ? 'Edit org' : 'New org'}</H3>
          <Pressable onPress={submit} hitSlop={8} disabled={busy}>
            <Body color={t.colors.primary} style={{ fontWeight: '700', opacity: busy ? 0.5 : 1 }}>
              Save
            </Body>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: t.spacing.s5 }}>
          <Card padding="s5">
            <Input label="Name *" value={f.name} onChangeText={(v) => set('name', v)} />
            <Input label="Code" value={f.code} onChangeText={(v) => set('code', v)} autoCapitalize="characters" />
            <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginBottom: t.spacing.s4 }}>
              <TypeToggle
                label="Hospital"
                active={f.type === 'hospital'}
                onPress={() => set('type', 'hospital')}
              />
              <TypeToggle
                label="Fleet"
                active={f.type === 'fleet_owner'}
                onPress={() => set('type', 'fleet_owner')}
              />
            </View>
            <Input label="Email *" value={f.email} onChangeText={(v) => set('email', v)} autoCapitalize="none" keyboardType="email-address" />
            <Input label="Phone" value={f.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
          </Card>

          <Card padding="s5" style={{ marginTop: t.spacing.s4 }}>
            <Input label="Address" value={f.address} onChangeText={(v) => set('address', v)} />
            <View style={{ flexDirection: 'row', gap: t.spacing.s3 }}>
              <View style={{ flex: 1 }}>
                <Input label="City" value={f.city} onChangeText={(v) => set('city', v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="State" value={f.state} onChangeText={(v) => set('state', v)} />
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: t.spacing.s3 }}>
              <View style={{ flex: 1 }}>
                <Input label="Country" value={f.country} onChangeText={(v) => set('country', v)} />
              </View>
              <View style={{ flex: 1 }}>
                <Input label="Postal" value={f.postalCode} onChangeText={(v) => set('postalCode', v)} />
              </View>
            </View>
          </Card>

          <Card padding="s5" style={{ marginTop: t.spacing.s4 }}>
            <Input label="Registration number" value={f.registrationNumber} onChangeText={(v) => set('registrationNumber', v)} />
            <Input label="License number" value={f.licenseNumber} onChangeText={(v) => set('licenseNumber', v)} />
          </Card>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function TypeToggle({ label, active, onPress }) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          flex: 1,
          paddingVertical: t.spacing.s3,
          alignItems: 'center',
          borderRadius: t.radius.xl,
          borderWidth: 2,
          borderColor: active ? t.colors.primary : t.colors.border,
          backgroundColor: active ? t.colors.primaryTint : 'transparent',
        },
        pressed && { opacity: 0.85 },
      ]}
    >
      <BodyStrong color={active ? t.colors.primary : t.colors.text}>{label}</BodyStrong>
    </Pressable>
  );
}
