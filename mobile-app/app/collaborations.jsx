// Collaborations + Partnerships — the cross-org relationship view. Segmented
// header switches between three lists:
//   - Requests: pending collaboration requests (incoming + outgoing)
//   - Active partnerships: orgs we're currently allied with
//   - History: closed / rejected / cancelled requests
//
// Hospital + fleet admins/staff can create new requests (other roles see a
// disabled CTA). Accept/reject/cancel actions live inline on each row and
// are scoped by direction + role on the backend; we just call the endpoint
// and let the server enforce.

import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '../src/api/client';
import {
  acceptCollaboration,
  cancelCollaboration,
  createCollaboration,
  listCollaborations,
  listMyPartnerships,
  rejectCollaboration,
} from '../src/api/collaborations';
import { listOrganizations } from '../src/api/organizations';
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
  SectionHeader,
  Small,
  toneForStatus,
} from '../src/ui';

const ROLES_THAT_CAN_REQUEST = new Set([
  'hospital_admin',
  'hospital_staff',
  'fleet_admin',
  'fleet_staff',
]);

export default function CollaborationsScreen() {
  const t = useTheme();
  const user = useAuth((s) => s.user);
  const [tab, setTab] = useState('requests');
  const [requests, setRequests] = useState([]);
  const [partnerships, setPartnerships] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState(null);
  const [showCreate, setShowCreate] = useState(false);

  const canRequest = !!user && ROLES_THAT_CAN_REQUEST.has(user.role);
  const myOrgId = user?.organization?.id ?? null;
  const myOrgType = user?.organization?.type ?? null;

  const load = useCallback(async () => {
    setErr(null);
    try {
      const [reqs, parts] = await Promise.all([
        listCollaborations().catch(() => []),
        listMyPartnerships().catch(() => []),
      ]);
      setRequests(reqs);
      setPartnerships(parts);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const visible = useMemo(() => {
    if (tab === 'partnerships') return partnerships;
    if (tab === 'history') {
      return requests.filter((r) =>
        ['rejected', 'cancelled', 'completed'].includes(r.status),
      );
    }
    return requests.filter((r) => r.status === 'pending' || r.status === 'approved');
  }, [tab, requests, partnerships]);

  const onAccept = (req) => {
    Alert.alert('Accept partnership?', `This will form a partnership with ${nameOfOther(req, myOrgId)}.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Accept',
        onPress: async () => {
          try {
            await acceptCollaboration(req.id);
            load();
          } catch (e) {
            Alert.alert('Failed', errorMessage(e));
          }
        },
      },
    ]);
  };
  const onReject = (req) => {
    Alert.alert('Reject request?', `Reject collaboration request from ${nameOfOther(req, myOrgId)}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reject',
        style: 'destructive',
        onPress: async () => {
          try {
            await rejectCollaboration(req.id);
            load();
          } catch (e) {
            Alert.alert('Failed', errorMessage(e));
          }
        },
      },
    ]);
  };
  const onCancel = (req) => {
    Alert.alert('Cancel request?', 'This withdraws your outgoing request.', [
      { text: 'Keep', style: 'cancel' },
      {
        text: 'Cancel request',
        style: 'destructive',
        onPress: async () => {
          try {
            await cancelCollaboration(req.id);
            load();
          } catch (e) {
            Alert.alert('Failed', errorMessage(e));
          }
        },
      },
    ]);
  };

  return (
    <Screen edges={['bottom']}>
      <View style={{ padding: t.spacing.s5, paddingBottom: t.spacing.s3 }}>
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'requests', label: 'Requests' },
            { value: 'partnerships', label: 'Active' },
            { value: 'history', label: 'History' },
          ]}
        />
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.colors.primary} />
        </View>
      ) : (
        <FlatList
          contentContainerStyle={{
            paddingHorizontal: t.spacing.s5,
            paddingBottom: t.spacing.s12,
            gap: t.spacing.s3,
          }}
          data={visible}
          keyExtractor={(item, index) =>
            String(item.id ?? item._id ?? `${tab}-${index}`)
          }
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
            <EmptyState
              icon={tab === 'partnerships' ? 'git-network-outline' : 'mail-open-outline'}
              title={
                tab === 'partnerships'
                  ? 'No active partnerships'
                  : tab === 'history'
                  ? 'No past requests'
                  : 'No requests'
              }
              subtitle={
                err ??
                (tab === 'partnerships'
                  ? 'Once you accept a collaboration request, it will appear here.'
                  : 'Send or receive a collaboration request to start a partnership.')
              }
              action={
                tab === 'requests' && canRequest ? (
                  <Button
                    label="New request"
                    icon={<Ionicons name="add" color="#fff" size={18} />}
                    onPress={() => setShowCreate(true)}
                  />
                ) : null
              }
            />
          }
          renderItem={({ item }) => {
            if (tab === 'partnerships') {
              return <PartnershipRow p={item} myOrgType={myOrgType} />;
            }
            const isMine = String(item.requester_organization_id) === String(myOrgId);
            const isIncoming = !isMine;
            return (
              <RequestRow
                r={item}
                myOrgId={myOrgId}
                isIncoming={isIncoming}
                onAccept={() => onAccept(item)}
                onReject={() => onReject(item)}
                onCancel={() => onCancel(item)}
              />
            );
          }}
        />
      )}

      {tab === 'requests' && canRequest ? (
        <Pressable
          onPress={() => setShowCreate(true)}
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

      <CreateRequestModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={() => {
          setShowCreate(false);
          load();
        }}
        userOrgType={user?.organization?.type}
        userOrgId={myOrgId}
      />
    </Screen>
  );
}

function otherOrgInfo(req, myOrgId) {
  // Backend shapes each request with hospital_* / fleet_* fields plus a
  // requester_organization_id. The "other" side is whichever organization
  // is not the caller's. Fall back to the requester side when myOrgId is
  // unknown (e.g. superadmin viewing all).
  const hospital = {
    id: req.hospital_id,
    name: req.hospital_name,
    code: req.hospital_code,
    type: 'hospital',
  };
  const fleet = {
    id: req.fleet_id,
    name: req.fleet_name,
    code: req.fleet_code,
    type: 'fleet_owner',
  };
  if (myOrgId && String(hospital.id) === String(myOrgId)) return fleet;
  if (myOrgId && String(fleet.id) === String(myOrgId)) return hospital;
  // No match — show the recipient side (opposite of requester).
  return String(req.requester_organization_id) === String(hospital.id) ? fleet : hospital;
}

function nameOfOther(req, myOrgId) {
  return otherOrgInfo(req, myOrgId).name ?? 'the other org';
}

function Segmented({ value, onChange, options }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.colors.surfaceAlt,
        borderRadius: t.radius.xl,
        padding: 4,
      }}
    >
      {options.map((o) => {
        const active = value === o.value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            style={({ pressed }) => [
              {
                flex: 1,
                paddingVertical: t.spacing.s3,
                borderRadius: t.radius.lg,
                alignItems: 'center',
                backgroundColor: active ? t.colors.card : 'transparent',
              },
              active && {
                shadowColor: t.colors.shadow,
                shadowOpacity: t.colors.shadowOpacity,
                shadowRadius: 4,
                shadowOffset: { width: 0, height: 1 },
                elevation: 1,
              },
              pressed && { opacity: 0.75 },
            ]}
          >
            <Small
              color={active ? t.colors.text : t.colors.textSecondary}
              style={{ fontWeight: active ? '600' : '500' }}
            >
              {o.label}
            </Small>
          </Pressable>
        );
      })}
    </View>
  );
}

function RequestRow({ r, myOrgId, isIncoming, onAccept, onReject, onCancel }) {
  const t = useTheme();
  const other = otherOrgInfo(r, myOrgId);

  return (
    <Card padding="s5">
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
        }}
      >
        <View style={{ flex: 1, paddingRight: t.spacing.s3 }}>
          <Caption>{isIncoming ? 'Incoming' : 'Outgoing'}</Caption>
          <BodyStrong style={{ marginTop: 2 }}>{other.name ?? '—'}</BodyStrong>
          <Small numberOfLines={1}>{other.code ?? ''} · {other.type?.replace('_', ' ') ?? ''}</Small>
        </View>
        <Badge label={r.status.replace('_', ' ')} tone={toneForStatus(r.status)} dot />
      </View>

      {r.message ? (
        <Body style={{ marginTop: t.spacing.s3 }} color={t.colors.textSecondary}>
          “{r.message}”
        </Body>
      ) : null}

      {r.status === 'pending' && (
        <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s4 }}>
          {isIncoming ? (
            <>
              <Button
                label="Reject"
                variant="secondary"
                onPress={onReject}
                style={{ flex: 1 }}
              />
              <Button
                label="Accept"
                onPress={onAccept}
                style={{ flex: 1 }}
              />
            </>
          ) : (
            <Button
              label="Cancel request"
              variant="secondary"
              onPress={onCancel}
              fullWidth
            />
          )}
        </View>
      )}

      <Caption style={{ marginTop: t.spacing.s3 }}>
        {new Date(r.created_at).toLocaleString()}
      </Caption>
    </Card>
  );
}

function PartnershipRow({ p, myOrgType }) {
  const t = useTheme();
  // Backend returns the partnership with populated `hospital_id` and
  // `fleet_id` objects ({ _id, name, code }). Pick the side that is NOT
  // the caller's organization. Superadmins (no org type) see the hospital
  // side by default.
  const hospital =
    p.hospital_id && typeof p.hospital_id === 'object' ? p.hospital_id : null;
  const fleet =
    p.fleet_id && typeof p.fleet_id === 'object' ? p.fleet_id : null;
  const partner =
    myOrgType === 'hospital'
      ? fleet
      : myOrgType === 'fleet_owner'
      ? hospital
      : hospital ?? fleet;
  const partnerType =
    myOrgType === 'hospital'
      ? 'fleet_owner'
      : myOrgType === 'fleet_owner'
      ? 'hospital'
      : hospital
      ? 'hospital'
      : 'fleet_owner';
  return (
    <Card padding="s4">
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
          <Ionicons name="git-network" color={t.colors.primary} size={20} />
        </View>
        <View style={{ flex: 1 }}>
          <BodyStrong>{partner?.name ?? '—'}</BodyStrong>
          <Small>
            {partnerType.replace('_', ' ')}
            {partner?.code ? ` · ${partner.code}` : ''}
          </Small>
        </View>
        <Badge label="Active" tone="success" />
      </View>
    </Card>
  );
}

function CreateRequestModal({ visible, onClose, onCreated, userOrgType, userOrgId }) {
  const t = useTheme();
  // If we are a hospital, request a fleet — and vice versa. The backend
  // doesn't enforce this, but mixing same-type partnerships is uncommon.
  const targetType = userOrgType === 'fleet_owner' ? 'hospital' : 'fleet_owner';
  const [orgs, setOrgs] = useState([]);
  const [picked, setPicked] = useState(null);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [loadingOrgs, setLoadingOrgs] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setPicked(null);
    setMessage('');
    setLoadingOrgs(true);
    listOrganizations({ type: targetType })
      .then((list) => setOrgs(list))
      .catch(() => setOrgs([]))
      .finally(() => setLoadingOrgs(false));
  }, [visible, targetType]);

  const submit = async () => {
    if (!picked) {
      Alert.alert('Pick an organization', 'Select an organization to send a request to.');
      return;
    }
    setBusy(true);
    try {
      // Backend expects { hospitalId, fleetId, requestType, message? }.
      // Map based on which side the current user belongs to.
      const payload = {
        requestType: 'partnership',
        message: message.trim() || undefined,
      };
      if (userOrgType === 'hospital') {
        payload.hospitalId = userOrgId;
        payload.fleetId = picked.id;
      } else if (userOrgType === 'fleet_owner') {
        payload.fleetId = userOrgId;
        payload.hospitalId = picked.id;
      } else {
        // Superadmin fallback — derive sides from the targetType.
        if (targetType === 'hospital') {
          payload.hospitalId = picked.id;
          payload.fleetId = userOrgId || null;
        } else {
          payload.fleetId = picked.id;
          payload.hospitalId = userOrgId || null;
        }
      }
      await createCollaboration(payload);
      onCreated();
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
      presentationStyle="pageSheet"
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
          <H3>New request</H3>
          <Pressable onPress={submit} hitSlop={8} disabled={busy}>
            <Body color={t.colors.primary} style={{ fontWeight: '700', opacity: busy ? 0.5 : 1 }}>
              Send
            </Body>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: t.spacing.s5 }}>
          <SectionHeader title={`Pick a ${targetType.replace('_', ' ')}`} />
          {loadingOrgs ? (
            <ActivityIndicator color={t.colors.primary} style={{ marginVertical: t.spacing.s5 }} />
          ) : orgs.length === 0 ? (
            <Body color={t.colors.textSecondary}>No organizations available.</Body>
          ) : (
            <View style={{ gap: t.spacing.s2 }}>
              {orgs.map((o) => {
                const active = picked?.id === o.id;
                return (
                  <Card
                    key={o.id}
                    padding="s4"
                    onPress={() => setPicked(o)}
                    style={
                      active
                        ? {
                            borderColor: t.colors.primary,
                            borderWidth: 2,
                            padding: t.spacing.s4 - 1,
                          }
                        : null
                    }
                  >
                    <View
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: t.spacing.s3,
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 11,
                          borderWidth: 2,
                          borderColor: active ? t.colors.primary : t.colors.border,
                          backgroundColor: active ? t.colors.primary : 'transparent',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {active ? (
                          <Ionicons name="checkmark" color="#fff" size={14} />
                        ) : null}
                      </View>
                      <View style={{ flex: 1 }}>
                        <BodyStrong>{o.name}</BodyStrong>
                        <Caption>{o.code}</Caption>
                      </View>
                    </View>
                  </Card>
                );
              })}
            </View>
          )}

          <View style={{ marginTop: t.spacing.s5 }}>
            <Input
              label="Message (optional)"
              value={message}
              onChangeText={setMessage}
              placeholder="A short note for the recipient…"
              multiline
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
