// Session detail — patient header, segmented Chat / Vitals / Info, live
// updates via Socket.IO. Mirrors the layout of the web SessionDetail page
// but reshuffled for a phone-sized viewport.

import { Ionicons } from '@expo/vector-icons';
import { useHeaderHeight } from '@react-navigation/elements';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
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
  addSessionData,
  addVitalSigns,
  buildSessionFileDownloadUrl,
  deleteSessionData,
  getSession,
  listSessionData,
  offboardSession,
  sendMessage,
  uploadSessionFile,
} from '../../src/api/sessions';
import { openVideoCall } from '../../src/lib/videoCall';
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
  // Default to the Console tab for active sessions (matches the web's
  // Ambulance Console layout). Closed sessions land on Info instead.
  const [tab, setTab] = useState('console');
  const [showVitalsModal, setShowVitalsModal] = useState(false);
  const [showMedSheet, setShowMedSheet] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  // Notes / medications / files — fetched separately because they live
  // under /sessions/:id/data (not in the patients-route session bundle).
  const [sessionData, setSessionData] = useState({ notes: [], medications: [], files: [] });
  const [uploading, setUploading] = useState(false);
  const [showNoteSheet, setShowNoteSheet] = useState(false);
  const [showOffboardSheet, setShowOffboardSheet] = useState(false);
  const [offboarding, setOffboarding] = useState(false);
  // Ambulance Console hardware toggles. The web stores these in local
  // React state too — there's no backend endpoint to actually flip
  // siren/aircon/oxygen on a real vehicle yet. Keeping the same UI parity.
  const [controls, setControls] = useState({
    mainPower: false,
    emergencyLights: false,
    siren: false,
    airConditioning: false,
    oxygenSupply: false,
    cabinCamera: false,
  });
  const listRef = useRef(null);

  const load = useCallback(async () => {
    setErr(null);
    try {
      // Fetch session + side-data in parallel. Side-data is best-effort —
      // a 404 / 403 here shouldn't block the page.
      const [r, sd] = await Promise.all([
        getSession(sessionId),
        listSessionData(sessionId).catch(() => ({ notes: [], medications: [], files: [] })),
      ]);
      setData(r);
      setSessionData(sd);
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

    // session_data_added / session_data_deleted — keep notes & files live.
    const onDataAdded = (payload) => {
      const d = payload?.data ?? payload;
      if (!d) return;
      setSessionData((prev) => {
        const next = { ...prev };
        const bucket = d.dataType === 'file' ? 'files' : d.dataType === 'medication' ? 'medications' : 'notes';
        if (next[bucket]?.some((x) => String(x.id) === String(d.id))) return prev;
        next[bucket] = [...(next[bucket] ?? []), d];
        return next;
      });
    };
    const onDataDeleted = (payload) => {
      const dataId = payload?.dataId;
      if (!dataId) return;
      setSessionData((prev) => ({
        notes: prev.notes.filter((x) => String(x.id) !== String(dataId)),
        medications: prev.medications.filter((x) => String(x.id) !== String(dataId)),
        files: prev.files.filter((x) => String(x.id) !== String(dataId)),
      }));
    };

    sock.on('new_message', onNewMessage);
    sock.on('message', onMessage);
    sock.on('vital_update', onVital);
    sock.on('session_ended', onSessionEnded);
    sock.on('session_offboarded', onSessionEnded);
    sock.on('session_data_added', onDataAdded);
    sock.on('session_data_deleted', onDataDeleted);

    return () => {
      sock.off('new_message', onNewMessage);
      sock.off('message', onMessage);
      sock.off('vital_update', onVital);
      sock.off('session_ended', onSessionEnded);
      sock.off('session_offboarded', onSessionEnded);
      sock.off('session_data_added', onDataAdded);
      sock.off('session_data_deleted', onDataDeleted);
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

  const pickAndUpload = async (source) => {
    try {
      let asset = null;
      if (source === 'camera') {
        const perm = await ImagePicker.requestCameraPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Camera access is required.');
          return;
        }
        const res = await ImagePicker.launchCameraAsync({ quality: 0.7 });
        if (res.canceled || !res.assets?.length) return;
        asset = res.assets[0];
        asset = {
          uri: asset.uri,
          name: asset.fileName ?? `photo-${Date.now()}.jpg`,
          type: asset.mimeType ?? 'image/jpeg',
        };
      } else if (source === 'library') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission needed', 'Photo library access is required.');
          return;
        }
        const res = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          quality: 0.7,
        });
        if (res.canceled || !res.assets?.length) return;
        const a = res.assets[0];
        asset = {
          uri: a.uri,
          name: a.fileName ?? `photo-${Date.now()}.jpg`,
          type: a.mimeType ?? 'image/jpeg',
        };
      } else {
        const res = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
        if (res.canceled || !res.assets?.length) return;
        const a = res.assets[0];
        asset = {
          uri: a.uri,
          name: a.name ?? `file-${Date.now()}`,
          type: a.mimeType ?? 'application/octet-stream',
        };
      }
      setUploading(true);
      const uploaded = await uploadSessionFile(sessionId, asset);
      // The socket should echo this back, but optimistically add it now in
      // case we miss the broadcast.
      if (uploaded) {
        setSessionData((prev) =>
          prev.files.some((x) => String(x.id) === String(uploaded.id))
            ? prev
            : { ...prev, files: [...prev.files, uploaded] },
        );
      }
    } catch (e) {
      Alert.alert('Upload failed', errorMessage(e));
    } finally {
      setUploading(false);
    }
  };

  const onAttach = () => {
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: ['Cancel', 'Take photo', 'Choose from library', 'Pick a file'],
          cancelButtonIndex: 0,
        },
        (i) => {
          if (i === 1) pickAndUpload('camera');
          else if (i === 2) pickAndUpload('library');
          else if (i === 3) pickAndUpload('document');
        },
      );
    } else {
      Alert.alert('Attach', 'Pick a source', [
        { text: 'Take photo', onPress: () => pickAndUpload('camera') },
        { text: 'Choose from library', onPress: () => pickAndUpload('library') },
        { text: 'Pick a file', onPress: () => pickAndUpload('document') },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  };

  const onAddNote = async (text) => {
    if (!text.trim()) return;
    try {
      const note = await addSessionData(sessionId, 'note', { text: text.trim() });
      if (note) {
        setSessionData((prev) =>
          prev.notes.some((x) => String(x.id) === String(note.id))
            ? prev
            : { ...prev, notes: [...prev.notes, note] },
        );
      }
      setShowNoteSheet(false);
    } catch (e) {
      Alert.alert('Save failed', errorMessage(e));
    }
  };

  const onAddMedication = async (medication) => {
    if (!medication?.name?.trim()) return;
    try {
      const created = await addSessionData(sessionId, 'medication', medication);
      if (created) {
        setSessionData((prev) =>
          prev.medications.some((x) => String(x.id) === String(created.id))
            ? prev
            : { ...prev, medications: [...prev.medications, created] },
        );
      }
      setShowMedSheet(false);
    } catch (e) {
      Alert.alert('Save failed', errorMessage(e));
    }
  };

  const onJoinCall = async () => {
    const displayName = me ? `${me.firstName ?? ''} ${me.lastName ?? ''}`.trim() : undefined;
    const r = await openVideoCall(sessionId, displayName);
    if (!r.opened) {
      Alert.alert('Couldn’t open call', 'Make sure Jitsi Meet is installed or a browser is available.');
    }
  };

  const onDeleteData = (entry) => {
    Alert.alert('Delete entry?', 'This removes the note or file from the session.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteSessionData(sessionId, entry.id);
            setSessionData((prev) => ({
              notes: prev.notes.filter((x) => String(x.id) !== String(entry.id)),
              medications: prev.medications.filter((x) => String(x.id) !== String(entry.id)),
              files: prev.files.filter((x) => String(x.id) !== String(entry.id)),
            }));
          } catch (e) {
            Alert.alert('Failed', errorMessage(e));
          }
        },
      },
    ]);
  };

  const openFile = async (entry) => {
    try {
      const url = await buildSessionFileDownloadUrl(sessionId, entry.id);
      const ok = await Linking.canOpenURL(url);
      if (ok) await Linking.openURL(url);
      else Alert.alert('Cannot open', 'No app on this device can open that link.');
    } catch (e) {
      Alert.alert('Failed', errorMessage(e));
    }
  };

  // Open the offboard sheet — we capture treatment notes here so the
  // backend's session metadata snapshot includes them. The list/dashboard
  // quick-offboards still skip notes by design (paramedics often need a
  // single-tap exit on a moving vehicle); the detail screen has the room.
  const onOffboard = () => setShowOffboardSheet(true);

  const submitOffboard = async (treatmentNotes) => {
    if (offboarding) return;
    setOffboarding(true);
    try {
      await offboardSession(sessionId, treatmentNotes || undefined);
      setShowOffboardSheet(false);
      router.back();
    } catch (e) {
      Alert.alert('Failed', errorMessage(e));
    } finally {
      setOffboarding(false);
    }
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

      <Tabs
        value={tab}
        onChange={setTab}
        vitalCount={vitals.length}
        reportCount={
          sessionData.notes.length + sessionData.medications.length + sessionData.files.length
        }
      />

      {tab === 'console' && (
        <ScrollView
          contentContainerStyle={{ padding: t.spacing.s4, gap: t.spacing.s3, paddingBottom: t.spacing.s10 }}
        >
          <VitalsDashboard latest={vitals[0] ?? null} onAdd={isActive ? () => setShowVitalsModal(true) : null} />

          {/* Camera + Video panels — mirrors the web Ambulance Console
              cards. Mobile can't embed the live device camera stream
              without a WebView (and the device URL is org-private anyway),
              so we link out to a browser the same way the web's "open in
              new tab" affordance does. */}
          <Card padding="s4">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2, marginBottom: t.spacing.s3 }}>
              <Ionicons name="videocam-outline" size={20} color={t.colors.primary} />
              <BodyStrong>Live camera feed</BodyStrong>
            </View>
            <View
              style={{
                aspectRatio: 16 / 9,
                backgroundColor: '#000',
                borderRadius: t.radius.lg,
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                marginBottom: t.spacing.s3,
              }}
            >
              <Ionicons name="alert-circle" color="#fff" size={32} />
              <Small color="rgba(255,255,255,0.85)">Camera not embedded on mobile</Small>
              <Small color="rgba(255,255,255,0.6)" style={{ textAlign: 'center', paddingHorizontal: 16 }}>
                Use a dev build with react-native-webview to stream inline,
                or open the device URL in your browser.
              </Small>
            </View>
            <Small color={t.colors.textSecondary}>
              The vehicle&apos;s onboard cameras stream through vehicleview.live and are
              viewable on the web Ambulance Console.
            </Small>
          </Card>

          <Card padding="s4">
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2, marginBottom: t.spacing.s3 }}>
              <Ionicons name="videocam" size={20} color={t.colors.primary} />
              <BodyStrong>Video call</BodyStrong>
            </View>
            <Body color={t.colors.textSecondary} style={{ marginBottom: t.spacing.s3 }}>
              Room <Body style={{ fontFamily: t.fontFamily.bodySemibold }}>
                resculance-session-{sessionId}
              </Body>
              {' '}— same room as web. Tap to join via Jitsi Meet (app if installed, else browser).
            </Body>
            <Button
              label="Join meeting"
              icon={<Ionicons name="videocam" color="#fff" size={18} />}
              onPress={onJoinCall}
              fullWidth
            />
          </Card>

          {/* Ambulance Controls — local toggles, same as the web. No
              backend endpoint persists these. */}
          {isActive ? (
            <Card padding="s4">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2, marginBottom: t.spacing.s3 }}>
                <Ionicons name="settings-outline" size={20} color={t.colors.primary} />
                <BodyStrong>Ambulance controls</BodyStrong>
              </View>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
                <ControlToggle
                  icon="power"
                  label="Main power"
                  active={controls.mainPower}
                  onPress={() => setControls((c) => ({ ...c, mainPower: !c.mainPower }))}
                />
                <ControlToggle
                  icon="warning"
                  label="Emergency"
                  tone="error"
                  active={controls.emergencyLights}
                  onPress={() => setControls((c) => ({ ...c, emergencyLights: !c.emergencyLights }))}
                />
                <ControlToggle
                  icon="megaphone"
                  label="Siren"
                  tone="warning"
                  active={controls.siren}
                  onPress={() => setControls((c) => ({ ...c, siren: !c.siren }))}
                />
                <ControlToggle
                  icon="snow"
                  label="Air con"
                  tone="info"
                  active={controls.airConditioning}
                  onPress={() => setControls((c) => ({ ...c, airConditioning: !c.airConditioning }))}
                />
                <ControlToggle
                  icon="medical"
                  label="Oxygen"
                  tone="success"
                  active={controls.oxygenSupply}
                  onPress={() => setControls((c) => ({ ...c, oxygenSupply: !c.oxygenSupply }))}
                />
                <ControlToggle
                  icon="camera"
                  label="Cabin cam"
                  active={controls.cabinCamera}
                  onPress={() => setControls((c) => ({ ...c, cabinCamera: !c.cabinCamera }))}
                />
              </View>
              <Caption style={{ marginTop: t.spacing.s3 }}>
                UI-only toggles — no backend endpoint persists these. Wire to the device
                bridge in a future build to actually flip hardware.
              </Caption>
            </Card>
          ) : null}

          {isActive ? (
            <Button
              label="Offboard session"
              variant="danger"
              icon={<Ionicons name="exit-outline" size={18} color="#fff" />}
              onPress={onOffboard}
              fullWidth
              style={{ marginTop: t.spacing.s2 }}
            />
          ) : null}
        </ScrollView>
      )}

      {tab === 'reports' && (
        <ScrollView contentContainerStyle={{ padding: t.spacing.s4, gap: t.spacing.s3, paddingBottom: t.spacing.s12 }}>
          {/* Notes */}
          <Card padding="s5">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.s3 }}>
              <BodyStrong>Notes ({sessionData.notes.length})</BodyStrong>
              {isActive ? (
                <Button
                  label="Add"
                  size="sm"
                  variant="secondary"
                  icon={<Ionicons name="create-outline" size={14} color={t.colors.text} />}
                  onPress={() => setShowNoteSheet(true)}
                />
              ) : null}
            </View>
            {sessionData.notes.length === 0 ? (
              <Body color={t.colors.textSecondary}>No notes yet.</Body>
            ) : (
              sessionData.notes.map((n) => (
                <NoteRow key={n.id} entry={n} onDelete={isActive ? () => onDeleteData(n) : null} />
              ))
            )}
          </Card>

          {/* Meds */}
          <Card padding="s5">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.s3 }}>
              <BodyStrong>Medications ({sessionData.medications.length})</BodyStrong>
              {isActive ? (
                <Button
                  label="Add"
                  size="sm"
                  variant="secondary"
                  icon={<Ionicons name="medkit-outline" size={14} color={t.colors.text} />}
                  onPress={() => setShowMedSheet(true)}
                />
              ) : null}
            </View>
            {sessionData.medications.length === 0 ? (
              <Body color={t.colors.textSecondary}>No medications recorded.</Body>
            ) : (
              sessionData.medications.map((m) => (
                <MedRow key={m.id} entry={m} onDelete={isActive ? () => onDeleteData(m) : null} />
              ))
            )}
          </Card>

          {/* Files */}
          <Card padding="s5">
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: t.spacing.s3 }}>
              <BodyStrong>Files ({sessionData.files.length})</BodyStrong>
              {isActive ? (
                <Button
                  label={uploading ? 'Uploading…' : 'Attach'}
                  size="sm"
                  loading={uploading}
                  icon={<Ionicons name="attach" size={14} color="#fff" />}
                  onPress={onAttach}
                />
              ) : null}
            </View>
            {sessionData.files.length === 0 ? (
              <Body color={t.colors.textSecondary}>No files attached.</Body>
            ) : (
              sessionData.files.map((f) => (
                <FileRow
                  key={f.id}
                  entry={f}
                  onOpen={() => openFile(f)}
                  onDelete={isActive ? () => onDeleteData(f) : null}
                />
              ))
            )}
          </Card>
        </ScrollView>
      )}

      {tab === 'chat' && (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1 }}
          keyboardVerticalOffset={Platform.OS === 'ios' ? headerHeight : 0}
        >
          <FlatList
            ref={listRef}
            data={communications}
            keyExtractor={(m) => String(m.id ?? m._id)}
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

          <Card padding="s4">
            <BodyStrong>Reports moved</BodyStrong>
            <Small color={t.colors.textSecondary} style={{ marginTop: 4 }}>
              Notes, medications, and files now live in the Reports tab. Hardware
              controls and offboarding live in the Console tab.
            </Small>
          </Card>
        </ScrollView>
      )}

      <NoteSheet
        visible={showNoteSheet}
        onClose={() => setShowNoteSheet(false)}
        onSubmit={onAddNote}
      />
      <OffboardSheet
        visible={showOffboardSheet}
        busy={offboarding}
        onClose={() => (offboarding ? null : setShowOffboardSheet(false))}
        onSubmit={submitOffboard}
      />
      <MedSheet
        visible={showMedSheet}
        onClose={() => setShowMedSheet(false)}
        onSubmit={onAddMedication}
      />

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

function Tabs({ value, onChange, vitalCount, reportCount }) {
  const t = useTheme();
  const tabs = [
    { value: 'console', label: 'Console' },
    { value: 'chat', label: 'Chat' },
    { value: 'vitals', label: `Vitals${vitalCount ? ` · ${vitalCount}` : ''}` },
    { value: 'reports', label: `Reports${reportCount ? ` · ${reportCount}` : ''}` },
    { value: 'info', label: 'Info' },
  ];
  // Horizontal scroll so 5 tabs don't squeeze each label on a small phone.
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{
        backgroundColor: t.colors.card,
        borderBottomWidth: 1,
        borderBottomColor: t.colors.border,
      }}
      contentContainerStyle={{ paddingHorizontal: t.spacing.s2 }}
    >
      {tabs.map((tb) => {
        const active = value === tb.value;
        return (
          <Pressable
            key={tb.value}
            onPress={() => onChange(tb.value)}
            style={({ pressed }) => [
              {
                paddingHorizontal: t.spacing.s4,
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
    </ScrollView>
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

// Vitals dashboard — 4 always-visible cards (HR, BP, SpO2, Temp) sourced
// from the most recent vital reading. Matches the web Ambulance Console's
// "Patient Vitals" panel layout.
function VitalsDashboard({ latest, onAdd }) {
  const t = useTheme();
  const tiles = [
    {
      key: 'hr',
      label: 'Heart rate',
      icon: 'heart',
      tone: 'error',
      value: latest?.heart_rate ?? null,
      unit: 'bpm',
    },
    {
      key: 'bp',
      label: 'Blood pressure',
      icon: 'pulse',
      tone: 'info',
      value:
        latest?.blood_pressure_systolic && latest?.blood_pressure_diastolic
          ? `${latest.blood_pressure_systolic}/${latest.blood_pressure_diastolic}`
          : null,
      unit: 'mmHg',
    },
    {
      key: 'spo2',
      label: 'SpO₂',
      icon: 'water',
      tone: 'primary',
      value: latest?.oxygen_saturation ?? null,
      unit: '%',
    },
    {
      key: 'temp',
      label: 'Temperature',
      icon: 'thermometer',
      tone: 'warning',
      value: latest?.temperature ?? null,
      unit: '°C',
    },
  ];

  return (
    <Card padding="s4">
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: t.spacing.s3,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s2 }}>
          <Ionicons name="pulse" color={t.colors.primary} size={20} />
          <BodyStrong>Patient vitals</BodyStrong>
        </View>
        {onAdd ? (
          <Button
            label="Record"
            size="sm"
            variant="secondary"
            icon={<Ionicons name="add" color={t.colors.text} size={14} />}
            onPress={onAdd}
          />
        ) : null}
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
        {tiles.map((tile) => {
          const fg = t.colors[tile.tone] ?? t.colors.primary;
          const bg = t.colors[`${tile.tone}Tint`] ?? t.colors.primaryTint;
          return (
            <View
              key={tile.key}
              style={{
                width: '48%',
                padding: t.spacing.s4,
                borderRadius: t.radius.lg,
                backgroundColor: bg,
                gap: 4,
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Caption color={fg} style={{ fontWeight: '700' }}>
                  {tile.label}
                </Caption>
                <Ionicons name={tile.icon} color={fg} size={16} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 4 }}>
                <H2 color={t.colors.text}>{tile.value != null ? String(tile.value) : '—'}</H2>
                {tile.value != null ? (
                  <Small color={t.colors.textSecondary}>{tile.unit}</Small>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
      {latest?.recorded_at ? (
        <Caption style={{ marginTop: t.spacing.s2 }}>
          Last reading {new Date(latest.recorded_at).toLocaleString()}
        </Caption>
      ) : (
        <Caption style={{ marginTop: t.spacing.s2 }}>
          No vitals recorded yet.
        </Caption>
      )}
    </Card>
  );
}

// One ambulance-control toggle. Filled-tone when active, outlined when off.
function ControlToggle({ icon, label, active, onPress, tone = 'primary' }) {
  const t = useTheme();
  const fg = t.colors[tone] ?? t.colors.primary;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        {
          width: '31%',
          aspectRatio: 1.1,
          borderRadius: t.radius.lg,
          backgroundColor: active ? fg : t.colors.surfaceAlt,
          borderWidth: 1,
          borderColor: active ? fg : t.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
        },
        pressed && { opacity: 0.8 },
      ]}
    >
      <Ionicons name={icon} color={active ? '#fff' : fg} size={22} />
      <Small color={active ? '#fff' : t.colors.text} style={{ fontWeight: '700', fontSize: 11 }}>
        {label}
      </Small>
    </Pressable>
  );
}

function MedRow({ entry, onDelete }) {
  const t = useTheme();
  const c = entry.content ?? {};
  const name = c.name ?? 'Medication';
  const dosage = c.dosage ?? '';
  const route = c.route ?? '';
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: t.spacing.s3,
        paddingVertical: t.spacing.s3,
        borderTopWidth: 1,
        borderTopColor: t.colors.border,
      }}
    >
      <View
        style={{
          width: 32, height: 32, borderRadius: 8,
          backgroundColor: t.colors.successTint,
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        <Ionicons name="medkit" size={16} color={t.colors.success} />
      </View>
      <View style={{ flex: 1 }}>
        <BodyStrong>{name}</BodyStrong>
        {dosage || route ? (
          <Body color={t.colors.textSecondary}>
            {[dosage, route].filter(Boolean).join(' · ')}
          </Body>
        ) : null}
        <Caption style={{ marginTop: 2 }}>
          {entry.addedBy?.name ?? '—'} · {new Date(entry.addedAt ?? entry.createdAt).toLocaleString()}
        </Caption>
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={t.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function MedSheet({ visible, onClose, onSubmit }) {
  const t = useTheme();
  const [name, setName] = useState('');
  const [dosage, setDosage] = useState('');
  const [route, setRoute] = useState('oral');
  const [busy, setBusy] = useState(false);

  // Reset on close so re-open shows a clean form.
  useEffect(() => {
    if (!visible) {
      setName('');
      setDosage('');
      setRoute('oral');
    }
  }, [visible]);

  const submit = async () => {
    if (!name.trim()) {
      Alert.alert('Required', 'Medication name is required.');
      return;
    }
    setBusy(true);
    try {
      await onSubmit({
        name: name.trim(),
        dosage: dosage.trim() || undefined,
        route: route.trim() || undefined,
      });
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
          <H3>Add medication</H3>
          <Pressable onPress={submit} hitSlop={8} disabled={busy}>
            <Body color={t.colors.primary} style={{ fontWeight: '700', opacity: busy ? 0.5 : 1 }}>
              Save
            </Body>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: t.spacing.s5 }}>
          <Input label="Name *" value={name} onChangeText={setName} placeholder="e.g. Aspirin" autoFocus />
          <Input label="Dosage" value={dosage} onChangeText={setDosage} placeholder="e.g. 300 mg" />
          <Caption style={{ marginBottom: t.spacing.s2 }}>Route</Caption>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.s2 }}>
            {['oral', 'iv', 'im', 'sc', 'inhaled', 'topical', 'sublingual'].map((r) => {
              const active = route === r;
              return (
                <Pressable
                  key={r}
                  onPress={() => setRoute(r)}
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
                    {r.toUpperCase()}
                  </Small>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function NoteRow({ entry, onDelete }) {
  const t = useTheme();
  const text =
    typeof entry.content === 'string'
      ? entry.content
      : entry.content?.text ?? JSON.stringify(entry.content ?? {});
  return (
    <View
      style={{
        flexDirection: 'row',
        gap: t.spacing.s3,
        paddingVertical: t.spacing.s3,
        borderTopWidth: 1,
        borderTopColor: t.colors.border,
      }}
    >
      <View
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          backgroundColor: t.colors.warningTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name="document-text" size={16} color={t.colors.warning} />
      </View>
      <View style={{ flex: 1 }}>
        <Body numberOfLines={6}>{text}</Body>
        <Caption style={{ marginTop: 2 }}>
          {entry.addedBy?.name ?? '—'} · {new Date(entry.addedAt ?? entry.createdAt).toLocaleString()}
        </Caption>
      </View>
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={8}>
          <Ionicons name="trash-outline" size={16} color={t.colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

function FileRow({ entry, onOpen, onDelete }) {
  const t = useTheme();
  const content = entry.content ?? {};
  const filename = content.filename ?? 'file';
  const mimetype = content.mimetype ?? '';
  const sizeStr = content.size != null ? formatBytes(content.size) : null;
  const isImage = typeof mimetype === 'string' && mimetype.startsWith('image/');
  return (
    <Pressable
      onPress={onOpen}
      style={{
        flexDirection: 'row',
        gap: t.spacing.s3,
        paddingVertical: t.spacing.s3,
        borderTopWidth: 1,
        borderTopColor: t.colors.border,
        alignItems: 'center',
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 8,
          backgroundColor: t.colors.infoTint,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Ionicons name={isImage ? 'image' : 'document-attach'} size={20} color={t.colors.info} />
      </View>
      <View style={{ flex: 1 }}>
        <BodyStrong numberOfLines={1}>{filename}</BodyStrong>
        <Caption>
          {sizeStr ? `${sizeStr} · ` : ''}
          {new Date(entry.addedAt ?? entry.createdAt).toLocaleString()}
        </Caption>
      </View>
      <Ionicons name="open-outline" size={16} color={t.colors.primary} />
      {onDelete ? (
        <Pressable onPress={onDelete} hitSlop={6} style={{ marginLeft: t.spacing.s2 }}>
          <Ionicons name="trash-outline" size={16} color={t.colors.textMuted} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function NoteSheet({ visible, onClose, onSubmit }) {
  const t = useTheme();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!text.trim()) {
      onClose();
      return;
    }
    setBusy(true);
    try {
      await onSubmit(text);
      setText('');
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
          <H3>Add note</H3>
          <Pressable onPress={submit} hitSlop={8} disabled={busy}>
            <Body color={t.colors.primary} style={{ fontWeight: '700', opacity: busy ? 0.5 : 1 }}>
              Save
            </Body>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: t.spacing.s5 }}>
          <Input
            label="Note"
            value={text}
            onChangeText={setText}
            placeholder="Anything the receiving doctor should know…"
            multiline
            autoFocus
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

function OffboardSheet({ visible, busy, onClose, onSubmit }) {
  const t = useTheme();
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (!visible) setNotes('');
  }, [visible]);

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
          <Pressable onPress={onClose} hitSlop={8} disabled={busy}>
            <Body color={busy ? t.colors.textMuted : t.colors.textSecondary}>Cancel</Body>
          </Pressable>
          <H3>Offboard session</H3>
          <Pressable onPress={() => onSubmit(notes.trim())} hitSlop={8} disabled={busy}>
            <Body color={t.colors.error} style={{ fontWeight: '700', opacity: busy ? 0.5 : 1 }}>
              {busy ? 'Offboarding…' : 'Offboard'}
            </Body>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s4 }}>
          <Card padding="s4">
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.s3 }}>
              <Ionicons name="information-circle" color={t.colors.primary} size={20} />
              <Body color={t.colors.textSecondary} style={{ flex: 1 }}>
                This marks the session complete, releases the ambulance, and captures the
                handover snapshot. Treatment notes are optional but saved with the session metadata.
              </Body>
            </View>
          </Card>
          <Input
            label="Treatment notes (optional)"
            value={notes}
            onChangeText={setNotes}
            placeholder="Summary of treatment given, handover details, anything the receiving team should know…"
            multiline
            editable={!busy}
            autoFocus
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
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
