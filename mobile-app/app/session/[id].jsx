// Session detail — patient header, segmented Chat / Vitals / Info, live
// updates via Socket.IO. Mirrors the layout of the web SessionDetail page
// but reshuffled for a phone-sized viewport.

import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { errorMessage } from '../../src/api/client';
import {
  addVitalSigns,
  getSession,
  offboardSession,
  sendMessage,
} from '../../src/api/sessions';
import { getSocket, joinSession, leaveSession } from '../../src/socket/client';
import { useAuth } from '../../src/store/auth';
import { useTheme } from '../../src/theme';
import {
  Badge,
  Body,
  BodyStrong,
  Button,
  Card,
  Caption,
  H2,
  H3,
  Input,
  Screen,
  SectionHeader,
  Small,
  toneForStatus,
} from '../../src/ui';
// Use a slightly elevated bg for the chat input so it doesn't blend into
// the page in dark mode.


export default function SessionDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams();
  const sessionId = String(id);
  const router = useRouter();
  const me = useAuth((s) => s.user);
  // Robust keyboard offset — derived from the actual Stack header, not a
  // hand-tuned magic number.
  const headerHeight = useHeaderHeight();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState('chat');
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      const r = await getSession(sessionId);
      setData(r);
    } catch (e) {
      setErr(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  // Join the session room + subscribe to live events.
  useEffect(() => {
    joinSession(sessionId);
    const sock = getSocket();
    if (!sock) return;

    const upsertMessage = (m) => {
      setData((prev) => {
        if (!prev) return prev;
        if (prev.communications.some((x) => x.id === m.id)) return prev;
        return { ...prev, communications: [...prev.communications, m] };
      });
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 50);
    };

    const onNewMessage = (m) => upsertMessage(normalizeIncomingMessage(m, sessionId));
    const onMessage = (m) => upsertMessage(normalizeIncomingMessage(m, sessionId));
    // Backend `vital_update` payload is the new vital row directly (with
    // `vitalId` and snake_case fields), not wrapped in `{ vitals }`.
    // Normalise so FlatList's keyExtractor on `_id` keeps working.
    const onVital = (v) => {
      const next = {
        _id: v?._id ?? v?.vitalId ?? `live-${Date.now()}`,
        session_id: v?.session_id ?? v?.sessionId ?? sessionId,
        patient_id: v?.patient_id ?? v?.patientId,
        recorded_by: v?.recorded_by ?? v?.recordedBy,
        heart_rate: v?.heart_rate ?? v?.heartRate ?? null,
        blood_pressure_systolic: v?.blood_pressure_systolic ?? v?.bloodPressureSystolic ?? null,
        blood_pressure_diastolic: v?.blood_pressure_diastolic ?? v?.bloodPressureDiastolic ?? null,
        temperature: v?.temperature ?? null,
        respiratory_rate: v?.respiratory_rate ?? v?.respiratoryRate ?? null,
        oxygen_saturation: v?.oxygen_saturation ?? v?.oxygenSaturation ?? null,
        blood_glucose: v?.blood_glucose ?? v?.bloodGlucose ?? null,
        consciousness_level: v?.consciousness_level ?? v?.consciousnessLevel ?? null,
        pain_scale: v?.pain_scale ?? v?.painScale ?? null,
        notes: v?.notes ?? null,
        recorded_at: v?.recorded_at ?? v?.recordedAt ?? new Date().toISOString(),
      };
      setData((prev) =>
        prev && !prev.vitals.some((x) => String(x._id) === String(next._id))
          ? { ...prev, vitals: [next, ...prev.vitals] }
          : prev,
      );
    };
    // Dedup: backend emits both `session_ended` and `session_offboarded`
    // when offboarding. We only want one Alert + one router.back().
    let ended = false;
    const onSessionEnded = () => {
      if (ended) return;
      ended = true;
      Alert.alert('Session ended', 'This session has been offboarded.', [
        { text: 'OK', onPress: () => router.back() },
      ]);
    };

    sock.on('new_message', onNewMessage);
    sock.on('message', onMessage);
    sock.on('vital_update', onVital);
    sock.on('session_ended', onSessionEnded);
    sock.on('session_offboarded', onSessionEnded);

    return () => {
      sock.off('new_message', onNewMessage);
      sock.off('message', onMessage);
      sock.off('vital_update', onVital);
      sock.off('session_ended', onSessionEnded);
      sock.off('session_offboarded', onSessionEnded);
      leaveSession(sessionId);
    };
  }, [sessionId, router]);

  const onSend = async () => {
    const text = draft.trim();
    if (!text || sending) return;
    setDraft('');
    setSending(true);
    try {
      const sent = await sendMessage(sessionId, { message: text });
      // Optimistic-ish append: insert immediately so the bubble shows even
      // if the socket misses the broadcast. `upsertMessage` dedupes by id,
      // so if the socket DOES echo back, we won't render it twice.
      if (sent?.id && me) {
        setData((prev) =>
          prev
            ? {
                ...prev,
                communications: prev.communications.some((x) => x.id === sent.id)
                  ? prev.communications
                  : [
                      ...prev.communications,
                      {
                        id: String(sent.id),
                        session_id: sessionId,
                        sender_id: String(me.id),
                        sender_first_name: me.firstName ?? '',
                        sender_last_name: me.lastName ?? '',
                        sender_role: me.role ?? '',
                        sender_email: me.email ?? '',
                        message_type: sent.messageType ?? 'text',
                        message: sent.message ?? text,
                        metadata: null,
                        created_at: new Date().toISOString(),
                      },
                    ],
              }
            : prev,
        );
      }
    } catch (e) {
      Alert.alert('Send failed', errorMessage(e));
      setDraft(text);
    } finally {
      setSending(false);
    }
  };

  const onOffboard = () => {
    Alert.alert(
      'Offboard session?',
      'This marks the session complete and releases the ambulance.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Offboard',
          style: 'destructive',
          onPress: async () => {
            try {
              await offboardSession(sessionId);
              router.back();
            } catch (e) {
              Alert.alert('Failed', errorMessage(e));
            }
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={t.colors.primary} />
        </View>
      </Screen>
    );
  }
  if (err || !data) {
    return (
      <Screen>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Body color={t.colors.textSecondary}>{err ?? 'Not found'}</Body>
        </View>
      </Screen>
    );
  }

  const { session, vitals, communications } = data;
  const isActive = session.status === 'onboarded' || session.status === 'in_transit';

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen
        options={{
          title: `${session.patient_first_name} ${session.patient_last_name}`,
        }}
      />

      {/* Patient header strip */}
      <View
        style={{
          paddingHorizontal: t.spacing.s5,
          paddingTop: t.spacing.s4,
          paddingBottom: t.spacing.s3,
          backgroundColor: t.colors.card,
          borderBottomWidth: 1,
          borderBottomColor: t.colors.border,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: t.spacing.s3,
          }}
        >
          <View style={{ flex: 1 }}>
            <Caption>{session.session_code}</Caption>
            <H2 style={{ marginTop: 2 }} numberOfLines={1}>
              {session.patient_first_name} {session.patient_last_name}
            </H2>
          </View>
          <Badge label={session.status.replace('_', ' ')} tone={toneForStatus(session.status)} dot />
        </View>
      </View>

      <Tabs value={tab} onChange={setTab} vitalCount={vitals.length} />

      {tab === 'chat' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
        >
          <FlatList
            ref={listRef}
            data={communications}
            keyExtractor={(m) => m.id}
            contentContainerStyle={{ padding: t.spacing.s4, gap: t.spacing.s2 }}
            renderItem={({ item }) => (
              <ChatBubble msg={item} mine={String(item.sender_id) === String(me?.id)} />
            )}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: t.spacing.s8 }}>
                <Ionicons name="chatbubbles-outline" size={32} color={t.colors.textMuted} />
                <Small style={{ marginTop: t.spacing.s2 }}>
                  No messages yet. Say hi to the crew.
                </Small>
              </View>
            }
          />
          <View
            style={{
              flexDirection: 'row',
              gap: t.spacing.s2,
              padding: t.spacing.s3,
              backgroundColor: t.colors.card,
              borderTopWidth: 1,
              borderTopColor: t.colors.border,
              alignItems: 'flex-end',
            }}
          >
            <TextInput
              value={draft}
              onChangeText={setDraft}
              placeholder={isActive ? 'Message the crew…' : 'Session is closed'}
              placeholderTextColor={t.colors.textMuted}
              multiline
              editable={!sending && isActive}
              style={{
                flex: 1,
                backgroundColor: t.colors.surfaceAlt,
                color: t.colors.text,
                borderRadius: t.radius.xl,
                borderWidth: 1,
                borderColor: t.colors.border,
                paddingHorizontal: t.spacing.s4,
                paddingTop: t.spacing.s3,
                paddingBottom: t.spacing.s3,
                fontFamily: t.fontFamily.body,
                fontSize: t.fontSize.base,
                maxHeight: 120,
              }}
            />
            <Pressable
              onPress={onSend}
              disabled={!draft.trim() || sending || !isActive}
              style={({ pressed }) => [
                {
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: t.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                },
                (!draft.trim() || sending || !isActive) && { opacity: 0.4 },
                pressed && { opacity: 0.7, transform: [{ scale: 0.97 }] },
              ]}
            >
              <Ionicons name="send" color="#fff" size={18} />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}

      {tab === 'vitals' && (
        <View style={{ flex: 1 }}>
          <FlatList
            data={vitals}
            keyExtractor={(v) => v._id}
            contentContainerStyle={{ padding: t.spacing.s4, gap: t.spacing.s3 }}
            ListEmptyComponent={
              <View style={{ alignItems: 'center', paddingVertical: t.spacing.s8 }}>
                <Ionicons name="heart-outline" size={32} color={t.colors.textMuted} />
                <Small style={{ marginTop: t.spacing.s2 }}>
                  No vitals recorded yet.
                </Small>
              </View>
            }
            renderItem={({ item }) => <VitalCard v={item} />}
          />
          {isActive && (
            <Pressable
              onPress={() => setShowVitalsModal(true)}
              style={({ pressed }) => [
                {
                  position: 'absolute',
                  bottom: t.spacing.s5,
                  right: t.spacing.s5,
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: t.colors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: t.colors.primary,
                  shadowOpacity: 0.4,
                  shadowRadius: 12,
                  shadowOffset: { width: 0, height: 6 },
                  elevation: 6,
                },
                pressed && { transform: [{ scale: 0.94 }] },
              ]}
            >
              <Ionicons name="add" size={28} color="#fff" />
            </Pressable>
          )}
        </View>
      )}

      {tab === 'info' && (
        <ScrollView
          contentContainerStyle={{ padding: t.spacing.s4, gap: t.spacing.s3 }}
        >
          <Card padding="s5">
            <SectionHeader title="Patient" />
            <Pressable onPress={() => router.push(`/patient/${session.patient_id}`)}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
                <View style={{ flex: 1 }}>
                  <BodyStrong>
                    {session.patient_first_name} {session.patient_last_name}
                  </BodyStrong>
                  <Small>Tap to view full patient record</Small>
                </View>
                <Ionicons name="chevron-forward" size={18} color={t.colors.textMuted} />
              </View>
            </Pressable>
          </Card>

          <Card padding="s5">
            <SectionHeader title="Ambulance" />
            <KV k="Code" v={session.ambulance_code} />
            <KV k="Registration" v={session.registration_number} />
            {session.vehicle_model ? <KV k="Vehicle" v={session.vehicle_model} /> : null}
          </Card>

          <Card padding="s5">
            <SectionHeader title="Trip" />
            <KV k="Pickup" v={session.pickup_location} />
            <KV k="Destination" v={session.destination_location} />
            {session.destination_hospital_name ? (
              <KV k="Hospital" v={session.destination_hospital_name} />
            ) : null}
            {session.chief_complaint ? <KV k="Chief complaint" v={session.chief_complaint} /> : null}
            {session.initial_assessment ? (
              <KV k="Initial assessment" v={session.initial_assessment} />
            ) : null}
            <KV k="Onboarded" v={new Date(session.onboarded_at).toLocaleString()} />
            {session.offboarded_at ? (
              <KV k="Offboarded" v={new Date(session.offboarded_at).toLocaleString()} />
            ) : null}
            {session.duration_minutes != null ? (
              <KV k="Duration" v={`${session.duration_minutes} min`} />
            ) : null}
          </Card>

          {session.crew?.length > 0 && (
            <Card padding="s5">
              <SectionHeader title={`Crew (${session.crew.length})`} />
              {session.crew.map((c) => (
                <CrewRow key={c.id} c={c} />
              ))}
            </Card>
          )}

          {isActive && (
            <Button
              label="Offboard session"
              variant="danger"
              icon={<Ionicons name="exit-outline" size={18} color="#fff" />}
              onPress={onOffboard}
              fullWidth
              style={{ marginTop: t.spacing.s2 }}
            />
          )}
        </ScrollView>
      )}

      <VitalsModal
        visible={showVitalsModal}
        patientId={session.patient_id}
        onClose={() => setShowVitalsModal(false)}
        onSaved={() => {
          setShowVitalsModal(false);
          load();
        }}
      />
    </Screen>
  );
}

// The backend emits message events with camelCase keys from socket and
// snake_case from HTTP. Normalize to the snake_case shape the UI expects.
function normalizeIncomingMessage(m, sessionId) {
  const get = (a, b) => m[a] ?? m[b];
  return {
    id: String(m.id ?? `${Date.now()}-${Math.random()}`),
    session_id: String(m.sessionId ?? m.session_id ?? sessionId),
    sender_id: String(get('senderId', 'sender_id') ?? ''),
    sender_first_name: String(get('senderFirstName', 'sender_first_name') ?? ''),
    sender_last_name: String(get('senderLastName', 'sender_last_name') ?? ''),
    sender_role: String(get('senderRole', 'sender_role') ?? ''),
    sender_email: String(get('senderEmail', 'sender_email') ?? ''),
    message_type: String(get('messageType', 'message_type') ?? 'text'),
    message: String(m.message ?? ''),
    metadata: m.metadata ?? null,
    created_at: String(get('createdAt', 'created_at') ?? new Date().toISOString()),
  };
}

function Tabs({ value, onChange, vitalCount }) {
  const t = useTheme();
  const tabs = [
    { value: 'chat', label: 'Chat', icon: 'chatbubbles-outline' },
    { value: 'vitals', label: `Vitals${vitalCount ? ` · ${vitalCount}` : ''}`, icon: 'pulse-outline' },
    { value: 'info', label: 'Info', icon: 'document-text-outline' },
  ];
  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: t.colors.card,
        borderBottomWidth: 1,
        borderBottomColor: t.colors.border,
      }}
    >
      {tabs.map((tb) => {
        const active = value === tb.value;
        return (
          <Pressable
            key={tb.value}
            onPress={() => onChange(tb.value)}
            style={({ pressed }) => [
              {
                flex: 1,
                paddingVertical: t.spacing.s3 + 2,
                alignItems: 'center',
                borderBottomWidth: 2,
                borderBottomColor: active ? t.colors.primary : 'transparent',
              },
              pressed && { opacity: 0.7 },
            ]}
          >
            <Small
              color={active ? t.colors.primary : t.colors.textSecondary}
              style={{ fontWeight: active ? '700' : '500' }}
            >
              {tb.label}
            </Small>
          </Pressable>
        );
      })}
    </View>
  );
}

function ChatBubble({ msg, mine }) {
  const t = useTheme();
  return (
    <View
      style={{
        maxWidth: '85%',
        alignSelf: mine ? 'flex-end' : 'flex-start',
        backgroundColor: mine ? t.colors.bubbleMine : t.colors.bubbleTheirs,
        borderColor: mine ? t.colors.bubbleMine : t.colors.border,
        borderWidth: 1,
        borderRadius: t.radius.xl,
        borderBottomRightRadius: mine ? 4 : t.radius.xl,
        borderBottomLeftRadius: mine ? t.radius.xl : 4,
        padding: t.spacing.s3,
        paddingHorizontal: t.spacing.s4,
      }}
    >
      {!mine && (
        <Caption color={t.colors.primary} style={{ marginBottom: 2 }}>
          {msg.sender_first_name} {msg.sender_last_name} · {msg.sender_role.replace('_', ' ')}
        </Caption>
      )}
      <Body color={mine ? t.colors.bubbleMineText : t.colors.bubbleTheirsText}>
        {msg.message}
      </Body>
      <Caption
        color={mine ? 'rgba(255,255,255,0.75)' : t.colors.textMuted}
        style={{ marginTop: 4, textAlign: 'right' }}
      >
        {new Date(msg.created_at).toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
        })}
      </Caption>
    </View>
  );
}

function VitalCard({ v }) {
  const t = useTheme();
  const cells = [
    ['HR', v.heart_rate, 'bpm'],
    [
      'BP',
      v.blood_pressure_systolic && v.blood_pressure_diastolic
        ? `${v.blood_pressure_systolic}/${v.blood_pressure_diastolic}`
        : null,
      'mmHg',
    ],
    ['Temp', v.temperature, '°C'],
    ['RR', v.respiratory_rate, '/min'],
    ['SpO₂', v.oxygen_saturation, '%'],
    ['Glucose', v.blood_glucose, ''],
    ['Pain', v.pain_scale, '/10'],
  ];
  return (
    <Card padding="s4">
      <Caption style={{ marginBottom: t.spacing.s3 }}>
        {new Date(v.recorded_at).toLocaleString()}
      </Caption>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s4 }}>
        {cells.map(([label, val, unit]) =>
          val != null && val !== '' ? (
            <View key={label} style={{ minWidth: 70 }}>
              <Caption>{label}</Caption>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <H3 style={{ fontSize: 22 }}>{String(val)}</H3>
                {unit ? <Small>{unit}</Small> : null}
              </View>
            </View>
          ) : null,
        )}
      </View>
      {v.notes ? (
        <Body
          color={t.colors.textSecondary}
          style={{ marginTop: t.spacing.s3, fontStyle: 'italic' }}
        >
          {v.notes}
        </Body>
      ) : null}
    </Card>
  );
}

function KV({ k, v }) {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: t.spacing.s2 }}>
      <Caption>{k}</Caption>
      <Body>{v}</Body>
    </View>
  );
}

function CrewRow({ c }) {
  const t = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: t.spacing.s2,
        gap: t.spacing.s3,
      }}
    >
      <View
        style={{
          width: 36,
          height: 36,
          borderRadius: 18,
          backgroundColor: t.colors.primaryTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Body color={t.colors.primary} style={{ fontWeight: '700' }}>
          {(c.first_name?.[0] ?? '') + (c.last_name?.[0] ?? '')}
        </Body>
      </View>
      <View style={{ flex: 1 }}>
        <BodyStrong>{c.first_name} {c.last_name}</BodyStrong>
        <Caption>{c.role.replace('_', ' ')}</Caption>
      </View>
    </View>
  );
}

function VitalsModal({ visible, patientId, onClose, onSaved }) {
  const t = useTheme();
  const [f, setF] = useState({});
  const [busy, setBusy] = useState(false);

  const fields = useMemo(
    () => [
      { key: 'heartRate', label: 'Heart rate (bpm)', numeric: true },
      { key: 'bloodPressureSystolic', label: 'Systolic BP', numeric: true },
      { key: 'bloodPressureDiastolic', label: 'Diastolic BP', numeric: true },
      { key: 'temperature', label: 'Temperature (°C)', numeric: true },
      { key: 'respiratoryRate', label: 'Respiratory rate', numeric: true },
      { key: 'oxygenSaturation', label: 'SpO₂ (%)', numeric: true },
      { key: 'bloodGlucose', label: 'Blood glucose', numeric: true },
      { key: 'painScale', label: 'Pain (0-10)', numeric: true },
      { key: 'consciousnessLevel', label: 'Consciousness (AVPU)' },
      { key: 'notes', label: 'Notes' },
    ],
    [],
  );

  const submit = async () => {
    const input = {};
    for (const { key, numeric } of fields) {
      const raw = f[key];
      if (raw === undefined || raw === '') continue;
      if (numeric) {
        const n = Number(raw);
        if (!Number.isNaN(n)) input[key] = n;
      } else {
        input[key] = raw;
      }
    }
    if (Object.keys(input).length === 0) {
      Alert.alert('Nothing to save', 'Fill at least one field.');
      return;
    }
    setBusy(true);
    try {
      await addVitalSigns(patientId, input);
      setF({});
      onSaved();
    } catch (e) {
      Alert.alert('Save failed', errorMessage(e));
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
          <H3>Add vitals</H3>
          <Pressable onPress={submit} disabled={busy} hitSlop={8}>
            <Body color={t.colors.primary} style={{ fontWeight: '700', opacity: busy ? 0.5 : 1 }}>
              Save
            </Body>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: t.spacing.s5 }}>
          {fields.map((field) => (
            <Input
              key={field.key}
              label={field.label}
              value={f[field.key] ?? ''}
              onChangeText={(v) => setF((p) => ({ ...p, [field.key]: v }))}
              placeholder={field.numeric ? '—' : ''}
              keyboardType={field.numeric ? 'decimal-pad' : 'default'}
              editable={!busy}
            />
          ))}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
