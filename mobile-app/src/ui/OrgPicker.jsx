// OrgPicker — the superadmin "viewing as" org selector. Mirrors the panel
// at the top of the frontend's Sessions / Ambulances / Patients pages:
// pick an organization type first (Hospital / Fleet Owner), then pick the
// organization itself from a searchable list.
//
// Returns null for non-superadmin users so screens can drop it in
// unconditionally — `<OrgPicker />` is a no-op for paramedics.
//
// Selection persists on the auth store (activeOrg) and the API client's
// request interceptor picks it up automatically, so individual API calls
// don't need to change.

import { Ionicons } from '@expo/vector-icons';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  SafeAreaView,
  TextInput,
  View,
} from 'react-native';
import { listOrganizations } from '../api/organizations';
import { errorMessage } from '../api/client';
import { useAuth } from '../store/auth';
import { useTheme } from '../theme';
import { Badge } from './Badge';
import { Card } from './Card';
import { Body, BodyStrong, Caption, H3, Small } from './Text';

const TYPE_OPTIONS = [
  { value: 'hospital', label: 'Hospital', icon: 'medkit-outline' },
  { value: 'fleet_owner', label: 'Fleet Owner', icon: 'car-sport-outline' },
];

export function OrgPicker({ style }) {
  const t = useTheme();
  const user = useAuth((s) => s.user);
  const activeOrg = useAuth((s) => s.activeOrg);
  const setActiveOrg = useAuth((s) => s.setActiveOrg);

  // Org Type filter — independent of the persisted selection so a superadmin
  // can change types to browse without losing their currently-selected org.
  const [typeFilter, setTypeFilter] = useState(activeOrg?.type ?? null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const typeLabel = useMemo(
    () => TYPE_OPTIONS.find((o) => o.value === typeFilter)?.label,
    [typeFilter],
  );

  // Hooks above; non-superadmins skip the UI entirely.
  if (user?.role !== 'superadmin') return null;

  return (
    <>
      <Card padding="s4" style={style}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2, marginBottom: t.spacing.s3 }}>
          <Ionicons name="business-outline" size={16} color={t.colors.primary} />
          <Caption style={{ color: t.colors.primary, fontWeight: '600', letterSpacing: 0.3, textTransform: 'uppercase' }}>
            Viewing as
          </Caption>
        </View>

        {/* Org Type segmented control */}
        <Caption style={{ marginBottom: t.spacing.s2 }}>Organization Type</Caption>
        <View
          style={{
            flexDirection: 'row',
            backgroundColor: t.colors.surfaceAlt,
            borderRadius: t.radius.lg,
            padding: 4,
            marginBottom: t.spacing.s3,
          }}
        >
          {TYPE_OPTIONS.map((opt) => {
            const active = typeFilter === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => {
                  setTypeFilter(opt.value);
                  // If the currently-selected org doesn't match the new type,
                  // clear it so the list below reflects the new filter.
                  if (activeOrg && activeOrg.type !== opt.value) {
                    setActiveOrg(null);
                  }
                }}
                style={({ pressed }) => [
                  {
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    paddingVertical: t.spacing.s2,
                    borderRadius: t.radius.md,
                    backgroundColor: active ? t.colors.card : 'transparent',
                  },
                  active && {
                    shadowColor: t.colors.shadow,
                    shadowOpacity: t.colors.shadowOpacity,
                    shadowRadius: 4,
                    shadowOffset: { width: 0, height: 1 },
                    elevation: 1,
                  },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Ionicons
                  name={opt.icon}
                  size={14}
                  color={active ? t.colors.primary : t.colors.textSecondary}
                />
                <Small
                  color={active ? t.colors.text : t.colors.textSecondary}
                  style={{ fontWeight: active ? '700' : '500' }}
                >
                  {opt.label}
                </Small>
              </Pressable>
            );
          })}
        </View>

        {/* Org selector — tap to open searchable list */}
        <Caption style={{ marginBottom: t.spacing.s2 }}>Select Organization</Caption>
        <Pressable
          disabled={!typeFilter}
          onPress={() => setPickerOpen(true)}
          style={({ pressed }) => [
            {
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.s3,
              borderRadius: t.radius.lg,
              borderWidth: 1,
              borderColor: t.colors.border,
              backgroundColor: typeFilter ? t.colors.card : t.colors.surfaceAlt,
              paddingHorizontal: t.spacing.s4,
              paddingVertical: t.spacing.s3,
              opacity: typeFilter ? 1 : 0.6,
            },
            pressed && { opacity: 0.8 },
          ]}
        >
          {activeOrg && activeOrg.type === typeFilter ? (
            <View style={{ flex: 1 }}>
              <BodyStrong numberOfLines={1}>{activeOrg.name}</BodyStrong>
              <Caption numberOfLines={1}>{activeOrg.code}</Caption>
            </View>
          ) : (
            <Body color={t.colors.textMuted} style={{ flex: 1 }} numberOfLines={1}>
              {typeFilter
                ? `Type to search or pick a ${typeLabel?.toLowerCase()}`
                : 'Pick an organization type first'}
            </Body>
          )}
          <Ionicons name="chevron-down" size={18} color={t.colors.textMuted} />
        </Pressable>

        {activeOrg ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginTop: t.spacing.s3,
            }}
          >
            <Badge
              label={activeOrg.type === 'hospital' ? 'Hospital' : 'Fleet Owner'}
              tone="primary"
            />
            <Pressable onPress={() => setActiveOrg(null)} hitSlop={8}>
              <Small color={t.colors.primary} style={{ fontWeight: '600' }}>
                Clear selection
              </Small>
            </Pressable>
          </View>
        ) : null}
      </Card>

      <OrgListModal
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        type={typeFilter}
        onSelect={(org) => {
          setActiveOrg(org);
          setPickerOpen(false);
        }}
      />
    </>
  );
}

// "Select an organization to load …" — a friendly empty state for screens
// when a superadmin hasn't picked an org yet. Returns null for everyone else.
export function OrgPickerEmpty({ resource = 'data' }) {
  const t = useTheme();
  const user = useAuth((s) => s.user);
  const activeOrg = useAuth((s) => s.activeOrg);
  if (user?.role !== 'superadmin' || activeOrg) return null;
  return (
    <View
      style={{
        alignItems: 'center',
        padding: t.spacing.s8,
        gap: t.spacing.s2,
      }}
    >
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: t.colors.primaryTint,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: t.spacing.s2,
        }}
      >
        <Ionicons name="business" size={26} color={t.colors.primary} />
      </View>
      <H3 style={{ textAlign: 'center' }}>Pick an organization</H3>
      <Body color={t.colors.textSecondary} style={{ textAlign: 'center', maxWidth: 280 }}>
        Choose an organization type and organization above to load {resource} for that org.
      </Body>
    </View>
  );
}

// Bottom-sheet modal — searchable list of orgs of the chosen type.
function OrgListModal({ visible, onClose, type, onSelect }) {
  const t = useTheme();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState(null);
  const [q, setQ] = useState('');

  const load = useCallback(async (filterType) => {
    if (!filterType) {
      setItems([]);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const orgs = await listOrganizations({ type: filterType });
      setItems(orgs);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, []);

  // Reload whenever the modal opens, or the type changes while it's open.
  useEffect(() => {
    if (visible) {
      setQ('');
      load(type);
    }
  }, [visible, type, load]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return items;
    return items.filter((o) => {
      const hay = `${o.name ?? ''} ${o.code ?? ''} ${o.contact_email ?? ''}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [items, q]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: t.spacing.s4,
            borderBottomWidth: 1,
            borderBottomColor: t.colors.border,
          }}
        >
          <H3>
            Select {type === 'hospital' ? 'Hospital' : type === 'fleet_owner' ? 'Fleet Owner' : 'Organization'}
          </H3>
          <Pressable onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={24} color={t.colors.textSecondary} />
          </Pressable>
        </View>

        <View style={{ paddingHorizontal: t.spacing.s4, paddingTop: t.spacing.s3 }}>
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
              autoCapitalize="none"
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
        </View>

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={t.colors.primary} />
          </View>
        ) : (
          <FlatList
            contentContainerStyle={{
              padding: t.spacing.s4,
              gap: t.spacing.s2,
            }}
            data={filtered}
            keyExtractor={(o) => String(o.id ?? o._id)}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', padding: t.spacing.s8, gap: t.spacing.s2 }}>
                <Ionicons name="business-outline" size={36} color={t.colors.textMuted} />
                <Body color={t.colors.textSecondary} style={{ textAlign: 'center' }}>
                  {err
                    ? err
                    : q
                      ? 'No organizations match that search.'
                      : 'No active organizations of this type.'}
                </Body>
              </View>
            }
            renderItem={({ item }) => {
              const id = String(item.id ?? item._id);
              return (
                <Card
                  padding="s4"
                  onPress={() =>
                    onSelect({
                      id,
                      name: item.name,
                      code: item.code,
                      type: item.type,
                    })
                  }
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
                    <View
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: 10,
                        backgroundColor: t.colors.primaryTint,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Ionicons
                        name={item.type === 'hospital' ? 'medkit' : 'car-sport'}
                        size={20}
                        color={t.colors.primary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <BodyStrong numberOfLines={1}>{item.name}</BodyStrong>
                      <Caption numberOfLines={1}>
                        {item.code}
                        {item.contact_email ? ` · ${item.contact_email}` : ''}
                      </Caption>
                    </View>
                    <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
                  </View>
                </Card>
              );
            }}
          />
        )}
      </SafeAreaView>
    </Modal>
  );
}
