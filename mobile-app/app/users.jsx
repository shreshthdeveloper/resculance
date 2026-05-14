// Users management. List, search, status filter, create, edit, approve,
// suspend, activate, delete. Mirrors the web frontend's /users page.
//
// Permission gating mirrors the backend: any role with VIEW_ALL_USERS or
// VIEW_OWN_ORG_USERS can see this screen; CREATE/UPDATE/DELETE/APPROVE
// actions are individually gated by the matching permission.

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
import { errorMessage } from '../src/api/client';
import {
  activateUser,
  approveUser,
  createUser,
  deleteUser,
  listUsers,
  suspendUser,
  updateUser,
} from '../src/api/users';
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
  { value: 'active', label: 'Active' },
  { value: 'pending_approval', label: 'Pending' },
  { value: 'suspended', label: 'Suspended' },
  { value: 'inactive', label: 'Inactive' },
];

const ROLES_FOR_FILTER = [
  '', 'hospital_admin', 'hospital_doctor', 'hospital_paramedic', 'hospital_staff',
  'fleet_admin', 'fleet_doctor', 'fleet_paramedic', 'fleet_driver', 'fleet_staff',
];

export default function UsersScreen() {
  const t = useTheme();
  const me = useAuth((s) => s.user);
  const activeOrg = useAuth((s) => s.activeOrg);
  const [items, setItems] = useState([]);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('active');
  const [roleFilter, setRoleFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);
  const [editing, setEditing] = useState(null);
  const [creating, setCreating] = useState(false);

  const isSuperadmin = me?.role === 'superadmin';
  const gatedBySuperadminOrg = isSuperadmin && !activeOrg;

  const canCreate = hasPermission(me?.role, PERMISSIONS.CREATE_USER);
  const canUpdate = hasPermission(me?.role, PERMISSIONS.UPDATE_USER);
  const canApprove = hasPermission(me?.role, PERMISSIONS.APPROVE_USER);
  const canDelete = hasPermission(me?.role, PERMISSIONS.DELETE_USER);
  const canView = hasAnyPermission(
    me?.role,
    PERMISSIONS.VIEW_ALL_USERS,
    PERMISSIONS.VIEW_OWN_ORG_USERS,
  );

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
      if (roleFilter) params.role = roleFilter;
      const r = await listUsers(params);
      setItems(r.users ?? []);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [status, q, roleFilter, gatedBySuperadminOrg, canView]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  // Debounce search.
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
          subtitle="Your role doesn't have access to user management."
        />
      </Screen>
    );
  }

  const onApprove = (u) =>
    confirmDo(`Approve ${u.firstName} ${u.lastName}?`, 'They will be able to sign in.', async () => {
      await approveUser(u.id);
      load();
    });
  const onSuspend = (u) =>
    confirmDo(`Suspend ${u.firstName}?`, 'They will not be able to sign in until reactivated.', async () => {
      await suspendUser(u.id);
      load();
    }, 'destructive');
  const onActivate = (u) =>
    confirmDo(`Activate ${u.firstName}?`, 'They will regain access.', async () => {
      await activateUser(u.id);
      load();
    });
  const onDelete = (u) =>
    confirmDo(`Delete ${u.firstName} ${u.lastName}?`, 'This is permanent.', async () => {
      await deleteUser(u.id);
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
            placeholder="Search name, email…"
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
              <Pill key={s.value} label={s.label} active={status === s.value} onPress={() => setStatus(s.value)} />
            ))}
            <View style={{ width: 1, backgroundColor: t.colors.border, marginHorizontal: t.spacing.s2 }} />
            {ROLES_FOR_FILTER.map((r) => (
              <Pill
                key={r || 'all'}
                label={r ? r.replace('_', ' ') : 'All roles'}
                active={roleFilter === r}
                onPress={() => setRoleFilter(r)}
              />
            ))}
          </View>
        </ScrollView>
      </View>

      {gatedBySuperadminOrg ? (
        <OrgPickerEmpty resource="users" />
      ) : (
        <FlatList
          contentContainerStyle={{
            paddingHorizontal: t.spacing.s5,
            paddingBottom: t.spacing.s12,
            gap: t.spacing.s3,
          }}
          data={loading ? [] : items}
          keyExtractor={(u) => u.id}
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
                icon="people-outline"
                title="No users"
                subtitle={err ?? 'Adjust the filters or create one.'}
                action={
                  canCreate ? (
                    <Button
                      label="New user"
                      icon={<Ionicons name="person-add" color="#fff" size={18} />}
                      onPress={() => setCreating(true)}
                    />
                  ) : null
                }
              />
            )
          }
          renderItem={({ item }) => (
            <UserRow
              u={item}
              canEdit={canUpdate}
              canApprove={canApprove && item.status === 'pending_approval'}
              canSuspend={canUpdate && item.status === 'active'}
              canActivate={canUpdate && (item.status === 'suspended' || item.status === 'inactive')}
              canDelete={canDelete && String(item.id) !== String(me?.id)}
              onEdit={() => setEditing(item)}
              onApprove={() => onApprove(item)}
              onSuspend={() => onSuspend(item)}
              onActivate={() => onActivate(item)}
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
          <Ionicons name="person-add" size={24} color="#fff" />
        </Pressable>
      ) : null}

      <UserFormModal
        mode="create"
        visible={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          setCreating(false);
          load();
        }}
        isSuperadmin={isSuperadmin}
        activeOrg={activeOrg}
      />
      <UserFormModal
        mode="edit"
        user={editing}
        visible={!!editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
        isSuperadmin={isSuperadmin}
        activeOrg={activeOrg}
      />
    </Screen>
  );
}

function confirmDo(title, message, fn, style) {
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Confirm',
      style: style || 'default',
      onPress: async () => {
        try {
          await fn();
        } catch (e) {
          Alert.alert('Failed', errorMessage(e));
        }
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
      <Small
        color={active ? '#fff' : t.colors.textSecondary}
        style={{ fontWeight: '600' }}
      >
        {label}
      </Small>
    </Pressable>
  );
}

function UserRow({ u, canEdit, canApprove, canSuspend, canActivate, canDelete, onEdit, onApprove, onSuspend, onActivate, onDelete }) {
  const t = useTheme();
  const initials = `${u.firstName?.[0] ?? '?'}${u.lastName?.[0] ?? ''}`.toUpperCase();
  return (
    <Card padding="s4">
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
        <View
          style={{
            width: 44, height: 44, borderRadius: 22,
            backgroundColor: t.colors.primaryTint,
            alignItems: 'center', justifyContent: 'center',
          }}
        >
          <BodyStrong color={t.colors.primary}>{initials}</BodyStrong>
        </View>
        <View style={{ flex: 1 }}>
          <BodyStrong numberOfLines={1}>{u.firstName} {u.lastName}</BodyStrong>
          <Caption numberOfLines={1}>{u.email}</Caption>
          <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
            <Badge label={(u.role ?? '—').replace('_', ' ')} tone="primary" />
            {u.organizationName ? <Badge label={u.organizationName} tone="neutral" /> : null}
          </View>
        </View>
        <Badge label={(u.status ?? '—').replace('_', ' ')} tone={toneForStatus(u.status)} dot />
      </View>

      <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s3, flexWrap: 'wrap' }}>
        {canEdit ? (
          <Button label="Edit" variant="secondary" size="sm" onPress={onEdit} style={{ flex: 1, minWidth: 80 }} />
        ) : null}
        {canApprove ? (
          <Button label="Approve" variant="success" size="sm" onPress={onApprove} style={{ flex: 1, minWidth: 90 }} />
        ) : null}
        {canSuspend ? (
          <Button label="Suspend" variant="outline" size="sm" onPress={onSuspend} style={{ flex: 1, minWidth: 90 }} />
        ) : null}
        {canActivate ? (
          <Button label="Activate" variant="success" size="sm" onPress={onActivate} style={{ flex: 1, minWidth: 90 }} />
        ) : null}
        {canDelete ? (
          <Button label="Delete" variant="danger" size="sm" onPress={onDelete} style={{ flex: 1, minWidth: 80 }} />
        ) : null}
      </View>
    </Card>
  );
}

function UserFormModal({ mode, user, visible, onClose, onSaved, isSuperadmin, activeOrg }) {
  const t = useTheme();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    if (mode === 'edit' && user) {
      setF({
        firstName: user.firstName ?? '',
        lastName: user.lastName ?? '',
        email: user.email ?? '',
        username: user.username ?? '',
        phone: user.phone ?? '',
        role: user.role ?? 'hospital_paramedic',
        password: '',
        confirmPassword: '',
      });
    } else {
      setF({
        firstName: '',
        lastName: '',
        email: '',
        username: '',
        phone: '',
        role: 'hospital_paramedic',
        password: '',
        confirmPassword: '',
      });
    }
  }, [visible, mode, user]);

  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));

  const submit = async () => {
    if (!f.firstName?.trim()) return Alert.alert('Required', 'First name is required.');
    if (mode === 'create' && !f.email?.trim()) {
      return Alert.alert('Required', 'Email is required.');
    }
    if (mode === 'create') {
      if (!f.password) return Alert.alert('Required', 'Password is required.');
      if (f.password !== f.confirmPassword) return Alert.alert('Mismatch', 'Passwords do not match.');
    }
    setBusy(true);
    try {
      // The backend `UserController.update` only honours
      // firstName, lastName, phone, status, role, organizationId,
      // profileImageUrl (userController.js:228). Sending `email` or
      // `username` on edit was silently dropped server-side — confusing
      // for users who saw the modal accept the change but it never
      // persisted. So we only include those fields on create.
      const payload = {
        firstName: f.firstName.trim(),
        lastName: f.lastName.trim() || undefined,
        phone: f.phone.trim() || undefined,
        role: f.role,
      };
      if (mode === 'create') {
        payload.email = f.email.trim();
        payload.username = f.username.trim() || undefined;
        payload.password = f.password;
        if (isSuperadmin && activeOrg) payload.organizationId = activeOrg.id;
      }
      if (mode === 'edit' && user) {
        await updateUser(user.id, payload);
      } else {
        await createUser(payload);
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
          <H3>{mode === 'edit' ? 'Edit user' : 'New user'}</H3>
          <Pressable onPress={submit} hitSlop={8} disabled={busy}>
            <Body color={t.colors.primary} style={{ fontWeight: '700', opacity: busy ? 0.5 : 1 }}>
              Save
            </Body>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: t.spacing.s5 }}>
          <Card padding="s5">
            <Input label="First name *" value={f.firstName} onChangeText={(v) => set('firstName', v)} />
            <Input label="Last name" value={f.lastName} onChangeText={(v) => set('lastName', v)} />
            <Input
              label={mode === 'edit' ? 'Email (cannot be changed)' : 'Email *'}
              value={f.email}
              onChangeText={mode === 'edit' ? undefined : (v) => set('email', v)}
              editable={mode !== 'edit'}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <Input
              label={mode === 'edit' ? 'Username (cannot be changed)' : 'Username'}
              value={f.username}
              onChangeText={mode === 'edit' ? undefined : (v) => set('username', v)}
              editable={mode !== 'edit'}
              autoCapitalize="none"
            />
            <Input label="Phone" value={f.phone} onChangeText={(v) => set('phone', v)} keyboardType="phone-pad" />
          </Card>

          <Card padding="s5" style={{ marginTop: t.spacing.s4 }}>
            <Caption style={{ marginBottom: t.spacing.s2 }}>Role</Caption>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
              {ROLES_FOR_FILTER.filter(Boolean).map((r) => (
                <Pill key={r} label={r.replace('_', ' ')} active={f.role === r} onPress={() => set('role', r)} />
              ))}
            </View>
          </Card>

          {mode === 'create' ? (
            <Card padding="s5" style={{ marginTop: t.spacing.s4 }}>
              <Input label="Password *" value={f.password} onChangeText={(v) => set('password', v)} secureTextEntry autoCapitalize="none" />
              <Input
                label="Confirm password *"
                value={f.confirmPassword}
                onChangeText={(v) => set('confirmPassword', v)}
                secureTextEntry
                autoCapitalize="none"
              />
              {isSuperadmin && !activeOrg ? (
                <Small color={t.colors.warning}>
                  Pick a viewing-as org on the Users list before creating — the new user will be assigned to that org.
                </Small>
              ) : null}
            </Card>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
