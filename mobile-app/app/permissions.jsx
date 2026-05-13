// Permissions matrix — read-only view that mirrors the web /permissions
// page. Shows every permission alongside which roles have it. Superadmin
// only (the route guards via VIEW_ACTIVITY_LOGS, same as the sidebar).
//
// The data here is sourced from the local permissions util (which itself
// mirrors backend/src/config/permissions.js). We don't fetch it from the
// backend because the backend doesn't expose a /permissions endpoint —
// the matrix is configuration, not runtime state.

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, TextInput, View } from 'react-native';
import { PERMISSIONS, hasPermission } from '../src/lib/permissions';
import { useAuth } from '../src/store/auth';
import { useTheme } from '../src/theme';
import {
  Badge,
  Body,
  BodyStrong,
  Card,
  Caption,
  EmptyState,
  Screen,
  SectionHeader,
  Small,
} from '../src/ui';

const ROLES = [
  'superadmin',
  'hospital_admin', 'hospital_doctor', 'hospital_paramedic', 'hospital_staff',
  'fleet_admin', 'fleet_doctor', 'fleet_paramedic', 'fleet_driver', 'fleet_staff',
];

// Group permission keys by category for readability.
const GROUPS = [
  {
    name: 'Organizations',
    keys: ['VIEW_ALL_ORGANIZATIONS', 'CREATE_ORGANIZATION', 'UPDATE_ORGANIZATION', 'DELETE_ORGANIZATION'],
  },
  {
    name: 'Users',
    keys: ['VIEW_ALL_USERS', 'VIEW_OWN_ORG_USERS', 'CREATE_USER', 'UPDATE_USER', 'APPROVE_USER', 'APPROVE_ADMIN', 'DELETE_USER'],
  },
  {
    name: 'Ambulances',
    keys: [
      'VIEW_ALL_AMBULANCES', 'VIEW_OWN_AMBULANCES', 'VIEW_ASSIGNED_AMBULANCES',
      'VIEW_PARTNERED_AMBULANCES', 'CREATE_AMBULANCE', 'UPDATE_AMBULANCE',
      'APPROVE_AMBULANCE', 'DELETE_AMBULANCE', 'ASSIGN_STAFF',
    ],
  },
  {
    name: 'Patients',
    keys: ['VIEW_PATIENTS', 'CREATE_PATIENT', 'UPDATE_PATIENT', 'ONBOARD_PATIENT', 'OFFBOARD_PATIENT', 'VIEW_VITAL_SIGNS'],
  },
  {
    name: 'Collaborations',
    keys: ['VIEW_COLLABORATIONS', 'CREATE_COLLABORATION', 'APPROVE_COLLABORATION', 'REJECT_COLLABORATION'],
  },
  {
    name: 'Dashboard & audit',
    keys: ['VIEW_DASHBOARD', 'VIEW_ANALYTICS', 'VIEW_ACTIVITY_LOGS'],
  },
];

export default function PermissionsScreen() {
  const t = useTheme();
  const me = useAuth((s) => s.user);
  const isSuperadmin = me?.role === 'superadmin';

  const [selectedRole, setSelectedRole] = useState(me?.role ?? 'superadmin');
  const [q, setQ] = useState('');

  const filteredGroups = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return GROUPS;
    return GROUPS.map((g) => ({
      ...g,
      keys: g.keys.filter((k) => k.toLowerCase().includes(query)),
    })).filter((g) => g.keys.length > 0);
  }, [q]);

  if (!isSuperadmin) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="shield-outline"
          title="Superadmin only"
          subtitle="The permissions matrix is restricted to system administrators."
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.s5, paddingBottom: t.spacing.s10, gap: t.spacing.s4 }}>
        <Card padding="s5">
          <BodyStrong>How to read this</BodyStrong>
          <Body color={t.colors.textSecondary} style={{ marginTop: t.spacing.s2 }}>
            Each row is a permission. The check column shows whether the
            currently selected role can perform that action. Pick a role
            below to inspect.
          </Body>
        </Card>

        {/* Role picker */}
        <View>
          <SectionHeader title="Role" />
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
              {ROLES.map((r) => (
                <Pill key={r} label={r.replace('_', ' ')} active={selectedRole === r} onPress={() => setSelectedRole(r)} />
              ))}
            </View>
          </ScrollView>
        </View>

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
            placeholder="Filter permissions…"
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

        {/* Matrix */}
        {filteredGroups.length === 0 ? (
          <Body color={t.colors.textSecondary} style={{ textAlign: 'center', marginTop: t.spacing.s5 }}>
            No permissions match.
          </Body>
        ) : (
          filteredGroups.map((group) => (
            <View key={group.name}>
              <SectionHeader title={group.name} />
              <Card padding="s2">
                {group.keys.map((key, idx) => {
                  const permValue = PERMISSIONS[key];
                  const has = hasPermission(selectedRole, permValue);
                  return (
                    <View
                      key={key}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        padding: t.spacing.s3,
                        borderTopWidth: idx === 0 ? 0 : 1,
                        borderTopColor: t.colors.border,
                      }}
                    >
                      <View style={{ flex: 1 }}>
                        <Body>{key.replace(/_/g, ' ').toLowerCase()}</Body>
                        <Caption>{permValue}</Caption>
                      </View>
                      {has ? (
                        <Badge label="Allowed" tone="success" dot />
                      ) : (
                        <Badge label="—" tone="neutral" />
                      )}
                    </View>
                  );
                })}
              </Card>
            </View>
          ))
        )}

        <Caption style={{ textAlign: 'center', marginTop: t.spacing.s4 }}>
          Source: backend/src/config/permissions.js (mirrored in src/lib/permissions.js).
        </Caption>
      </ScrollView>
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
      <Small color={active ? '#fff' : t.colors.textSecondary} style={{ fontWeight: '600' }}>
        {label}
      </Small>
    </Pressable>
  );
}
