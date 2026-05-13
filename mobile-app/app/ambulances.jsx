// Org-wide ambulance management. Distinct from the "My ambulance" tab
// which is paramedic-focused (one or two assigned vehicles). This screen
// is the equivalent of the web frontend's /ambulances page: list everything
// in the org with create, edit, approve, assign staff, activate/deactivate,
// delete.

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
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
import {
  activateAmbulance,
  approveAmbulance,
  assignUserToAmbulance,
  createAmbulance,
  deactivateAmbulance,
  deleteAmbulance,
  getAssignedUsers,
  listAmbulancesForOrg,
  unassignUserFromAmbulance,
  updateAmbulance,
} from '../src/api/ambulances';
import { errorMessage } from '../src/api/client';
import { listUsers } from '../src/api/users';
import { PERMISSIONS, hasAnyPermission, hasPermission } from '../src/lib/permissions';
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

const STATUS_TABS = [
  { value: '', label: 'All' },
  { value: 'available', label: 'Available' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'maintenance', label: 'Maintenance' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'inactive', label: 'Inactive' },
];

export default function AmbulancesScreen() {
  const t = useTheme();
  const me = useAuth((s) => s.user);
  const activeOrg = useAuth((s) => s.activeOrg);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);
  const [assignFor, setAssignFor] = useState(null); // ambulance object → opens assign sheet

  const isSuperadmin = me?.role === 'superadmin';
  const gatedBySuperadminOrg = isSuperadmin && !activeOrg;

  const canView = hasAnyPermission(
    me?.role,
    PERMISSIONS.VIEW_ALL_AMBULANCES,
    PERMISSIONS.VIEW_OWN_AMBULANCES,
    PERMISSIONS.VIEW_ASSIGNED_AMBULANCES,
    PERMISSIONS.VIEW_PARTNERED_AMBULANCES,
  );
  const canCreate = hasPermission(me?.role, PERMISSIONS.CREATE_AMBULANCE);
  const canUpdate = hasPermission(me?.role, PERMISSIONS.UPDATE_AMBULANCE);
  const canApprove = hasPermission(me?.role, PERMISSIONS.APPROVE_AMBULANCE);
  const canAssign = hasPermission(me?.role, PERMISSIONS.ASSIGN_STAFF);
  const canDelete = hasPermission(me?.role, PERMISSIONS.DELETE_AMBULANCE);
  const canDeactivate = isSuperadmin; // backend gates with superadmin role

  const load = useCallback(async () => {
    setErr(null);
    if (gatedBySuperadminOrg || !canView) {
      setItems([]);
      setLoading(false);
      setRefreshing(false);
      return;
    }
    try {
      const params = { limit: 200 };
      if (status) params.status = status;
      if (q) params.search = q;
      const list = await listAmbulancesForOrg(params);
      setItems(list);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, q, gatedBySuperadminOrg, canView]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    const id = setTimeout(() => load(), 300);
    return () => clearTimeout(id);
  }, [q, load]);

  if (!canView) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="lock-closed-outline"
          title="Not available"
          subtitle="Your role doesn't have access to ambulance management."
        />
      </Screen>
    );
  }

  const onApprove = (a) =>
    confirm(`Approve ${a.ambulance_code}?`, 'Make this ambulance active.', async () => {
      await approveAmbulance(a.id);
      load();
    });
  const onActivate = (a) =>
    confirm(`Activate ${a.ambulance_code}?`, null, async () => {
      await activateAmbulance(a.id);
      load();
    });
  const onDeactivate = (a) =>
    confirm(`Deactivate ${a.ambulance_code}?`, 'Existing sessions complete; new ones blocked.', async () => {
      await deactivateAmbulance(a.id);
      load();
    }, 'destructive');
  const onDelete = (a) =>
    confirm(`Delete ${a.ambulance_code}?`, 'This is permanent.', async () => {
      await deleteAmbulance(a.id);
      load();
    }, 'destructive');

  return (
    <Screen edges={['bottom']}>
      <View style={{ padding: t.spacing.s5, paddingBottom: t.spacing.s3, gap: t.spacing.s3 }}>
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
            placeholder="Search code, registration…"
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
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
            {STATUS_TABS.map((s) => (
              <Pill key={s.value || 'all'} label={s.label} active={status === s.value} onPress={() => setStatus(s.value)} />
            ))}
          </View>
        </ScrollView>
      </View>

      {gatedBySuperadminOrg ? (
        <OrgPickerEmpty resource="ambulances" />
      ) : (
        <FlatList
          contentContainerStyle={{
            paddingHorizontal: t.spacing.s5,
            paddingBottom: t.spacing.s12,
            gap: t.spacing.s3,
          }}
          data={loading ? [] : items}
          keyExtractor={(a) => a.id}
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
                icon="car-sport-outline"
                title="No ambulances"
                subtitle={err ?? 'No ambulances visible to you. Try adjusting filters.'}
                action={
                  canCreate ? (
                    <Button
                      label="New ambulance"
                      icon={<Ionicons name="add" color="#fff" size={18} />}
                      onPress={() => setCreating(true)}
                    />
                  ) : null
                }
              />
            )
          }
          renderItem={({ item }) => (
            <AmbulanceRow
              a={item}
              canEdit={canUpdate}
              canApprove={canApprove && item.status === 'pending_approval'}
              canDeactivate={canDeactivate && item.status !== 'inactive'}
              canActivate={canDeactivate && item.status === 'inactive'}
              canAssign={canAssign}
              canDelete={canDelete}
              onEdit={() => setEditing(item)}
              onApprove={() => onApprove(item)}
              onActivate={() => onActivate(item)}
              onDeactivate={() => onDeactivate(item)}
              onAssign={() => setAssignFor(item)}
              onDelete={() => onDelete(item)}
            />
          )}
        />
      )}

      {canCreate ? (
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
      ) : null}

      <AmbulanceFormModal
        mode="create"
        visible={creating}
        onClose={() => setCreating(false)}
        onSaved={() => { setCreating(false); load(); }}
        isSuperadmin={isSuperadmin}
        activeOrg={activeOrg}
      />
      <AmbulanceFormModal
        mode="edit"
        amb={editing}
        visible={!!editing}
        onClose={() => setEditing(null)}
        onSaved={() => { setEditing(null); load(); }}
        isSuperadmin={isSuperadmin}
        activeOrg={activeOrg}
      />
      <AssignStaffModal
        amb={assignFor}
        onClose={() => setAssignFor(null)}
        onChanged={load}
      />
    </Screen>
  );
}

function confirm(title, msg, fn, style) {
  Alert.alert(title, msg ?? '', [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Confirm',
      style: style || 'default',
      onPress: async () => {
        try { await fn(); } catch (e) { Alert.alert('Failed', errorMessage(e)); }
      },
    },
  ]);
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
      <Small color={active ? '#fff' : t.colors.textSecondary} style={{ fontWeight: '600' }}>
        {label}
      </Small>
    </Pressable>
  );
}

function AmbulanceRow({
  a,
  canEdit, canApprove, canDeactivate, canActivate, canAssign, canDelete,
  onEdit, onApprove, onDeactivate, onActivate, onAssign, onDelete,
}) {
  const t = useTheme();
  return (
    <Card padding="s4">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
        <View
          style={{
            width: 44, height: 44, borderRadius: 12,
            backgroundColor: t.colors.primaryTint,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <Ionicons name="car-sport" color={t.colors.primary} size={22} />
        </View>
        <View style={{ flex: 1 }}>
          <BodyStrong numberOfLines={1}>{a.ambulance_code}</BodyStrong>
          <Caption numberOfLines={1}>{a.registration_number}</Caption>
          {a.vehicle_model ? <Caption numberOfLines={1}>{a.vehicle_model}</Caption> : null}
        </View>
        <Badge label={(a.status ?? '—').replace('_', ' ')} tone={toneForStatus(a.status)} dot />
      </View>

      <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s3, flexWrap: 'wrap' }}>
        {canEdit ? (
          <Button label="Edit" variant="secondary" size="sm" onPress={onEdit} style={{ flex: 1, minWidth: 80 }} />
        ) : null}
        {canAssign ? (
          <Button label="Assign" variant="secondary" size="sm" onPress={onAssign} style={{ flex: 1, minWidth: 80 }} />
        ) : null}
        {canApprove ? (
          <Button label="Approve" variant="success" size="sm" onPress={onApprove} style={{ flex: 1, minWidth: 90 }} />
        ) : null}
        {canActivate ? (
          <Button label="Activate" variant="success" size="sm" onPress={onActivate} style={{ flex: 1, minWidth: 90 }} />
        ) : null}
        {canDeactivate ? (
          <Button label="Deactivate" variant="outline" size="sm" onPress={onDeactivate} style={{ flex: 1, minWidth: 100 }} />
        ) : null}
        {canDelete ? (
          <Button label="Delete" variant="danger" size="sm" onPress={onDelete} style={{ flex: 1, minWidth: 80 }} />
        ) : null}
      </View>
    </Card>
  );
}

// Backend Ambulance schema only stores: registration_number, vehicle_model,
// vehicle_type (BLS/ALS/SCU enum). ambulance_code is auto-generated, status
// transitions are handled via approve/activate/deactivate routes, and the
// "year / chassis / engine / insurance / fitness" fields are *not* in the
// Mongo schema — sending them is harmless but they won't persist. Keep the
// form aligned with what actually survives the round-trip.
const VEHICLE_TYPES = [
  { value: 'BLS', label: 'BLS — Basic Life Support' },
  { value: 'ALS', label: 'ALS — Advanced Life Support' },
  { value: 'SCU', label: 'SCU — Specialty Care Unit' },
];

function AmbulanceFormModal({ mode, amb, visible, onClose, onSaved, isSuperadmin, activeOrg }) {
  const t = useTheme();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && amb) {
      setF({
        registration_number: amb.registration_number ?? '',
        vehicle_model: amb.vehicle_model ?? '',
        vehicle_type: amb.vehicle_type ?? 'BLS',
      });
    } else {
      setF({
        registration_number: '',
        vehicle_model: '',
        vehicle_type: 'BLS',
      });
    }
  }, [visible, mode, amb]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.registration_number?.trim()) return Alert.alert('Required', 'Registration number is required.');
    if (!f.vehicle_type) return Alert.alert('Required', 'Vehicle type is required.');
    if (!VEHICLE_TYPES.some((v) => v.value === f.vehicle_type)) {
      return Alert.alert('Invalid', 'Vehicle type must be BLS, ALS, or SCU.');
    }
    setBusy(true);
    try {
      // Backend reads `vehicleNumber` (not registrationNumber) on create and
      // `vehicleModel` / `vehicleType` on both create and update.
      const payload = mode === 'edit'
        ? {
            vehicleModel: f.vehicle_model.trim() || undefined,
            vehicleType: f.vehicle_type,
          }
        : {
            vehicleNumber: f.registration_number.trim(),
            vehicleModel: f.vehicle_model.trim() || undefined,
            vehicleType: f.vehicle_type,
          };
      if (mode === 'create' && isSuperadmin && activeOrg) {
        payload.organizationId = activeOrg.id;
      }
      if (mode === 'edit' && amb) {
        await updateAmbulance(amb.id, payload);
      } else {
        await createAmbulance(payload);
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
          <H3>{mode === 'edit' ? 'Edit ambulance' : 'New ambulance'}</H3>
          <Pressable onPress={submit} hitSlop={8} disabled={busy}>
            <Body color={t.colors.primary} style={{ fontWeight: '700', opacity: busy ? 0.5 : 1 }}>
              Save
            </Body>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: t.spacing.s5 }}>
          <Card padding="s5">
            <Input
              label="Registration number *"
              value={f.registration_number}
              onChangeText={(v) => set('registration_number', v)}
              autoCapitalize="characters"
              editable={mode !== 'edit'} // backend update doesn't accept reg number changes
            />
            {mode === 'edit' ? (
              <Caption style={{ marginTop: -8, marginBottom: t.spacing.s3 }}>
                Registration is fixed once the ambulance is created.
              </Caption>
            ) : null}
            <Input label="Vehicle model" value={f.vehicle_model} onChangeText={(v) => set('vehicle_model', v)} placeholder="e.g. Mercedes Sprinter 2020" />
            <Caption style={{ marginBottom: t.spacing.s2 }}>Type *</Caption>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2, marginBottom: t.spacing.s3 }}>
              {VEHICLE_TYPES.map((tp) => (
                <Pill key={tp.value} label={tp.label} active={f.vehicle_type === tp.value} onPress={() => set('vehicle_type', tp.value)} />
              ))}
            </View>
          </Card>
          {mode === 'create' ? (
            <Card padding="s4" style={{ marginTop: t.spacing.s4 }}>
              <Caption>
                New ambulances are created in pending_approval status and need a superadmin to approve before they can be assigned or used for onboarding.
              </Caption>
            </Card>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function AssignStaffModal({ amb, onClose, onChanged }) {
  const t = useTheme();
  const [assigned, setAssigned] = useState([]);
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!amb) return;
    (async () => {
      setLoading(true);
      try {
        const [a, u] = await Promise.all([
          getAssignedUsers(amb.id).catch(() => []),
          listUsers({ limit: 200, status: 'active' }).catch(() => ({ users: [] })),
        ]);
        setAssigned(a);
        setCandidates(u.users ?? []);
      } finally {
        setLoading(false);
      }
    })();
  }, [amb]);

  if (!amb) {
    return (
      <Modal visible={false} transparent>
        <View />
      </Modal>
    );
  }

  const assignedIds = new Set(assigned.map((x) => String(x.id)));

  const onAssign = async (userId) => {
    setBusy(true);
    try {
      await assignUserToAmbulance(amb.id, userId);
      const a = await getAssignedUsers(amb.id);
      setAssigned(a);
      onChanged?.();
    } catch (e) {
      Alert.alert('Failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  const onUnassign = async (userId) => {
    setBusy(true);
    try {
      await unassignUserFromAmbulance(amb.id, userId);
      const a = await getAssignedUsers(amb.id);
      setAssigned(a);
      onChanged?.();
    } catch (e) {
      Alert.alert('Failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      visible
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
            <Body color={t.colors.textSecondary}>Done</Body>
          </Pressable>
          <H3 numberOfLines={1}>Assign · {amb.ambulance_code}</H3>
          <View style={{ width: 40 }} />
        </View>
        <ScrollView contentContainerStyle={{ padding: t.spacing.s5 }}>
          <Caption style={{ marginBottom: t.spacing.s2 }}>Currently assigned</Caption>
          {assigned.length === 0 ? (
            <Body color={t.colors.textSecondary}>Nobody is assigned to this ambulance.</Body>
          ) : (
            <View style={{ gap: t.spacing.s2 }}>
              {assigned.map((u) => (
                <Card key={u.id} padding="s4">
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
                    <View
                      style={{
                        width: 36, height: 36, borderRadius: 18,
                        backgroundColor: t.colors.primary,
                        alignItems: 'center', justifyContent: 'center',
                      }}
                    >
                      <BodyStrong color="#fff">
                        {(u.firstName?.[0] ?? '?') + (u.lastName?.[0] ?? '')}
                      </BodyStrong>
                    </View>
                    <View style={{ flex: 1 }}>
                      <BodyStrong>{u.firstName} {u.lastName}</BodyStrong>
                      <Caption>{(u.role ?? '').replace('_', ' ')}</Caption>
                    </View>
                    <Button
                      label="Remove"
                      variant="danger"
                      size="sm"
                      onPress={() => onUnassign(u.id)}
                      disabled={busy}
                    />
                  </View>
                </Card>
              ))}
            </View>
          )}

          <Caption style={{ marginTop: t.spacing.s5, marginBottom: t.spacing.s2 }}>Add staff</Caption>
          {loading ? (
            <SkeletonRow />
          ) : (
            <View style={{ gap: t.spacing.s2 }}>
              {candidates
                .filter((u) => !assignedIds.has(String(u.id)))
                .map((u) => (
                  <Card key={u.id} padding="s4">
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
                      <View style={{ flex: 1 }}>
                        <BodyStrong>{u.firstName} {u.lastName}</BodyStrong>
                        <Caption>{(u.role ?? '').replace('_', ' ')} · {u.email}</Caption>
                      </View>
                      <Button label="Assign" size="sm" onPress={() => onAssign(u.id)} disabled={busy} />
                    </View>
                  </Card>
                ))}
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
