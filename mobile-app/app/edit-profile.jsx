// Edit profile — first/last name, phone, and avatar. The backend's
// PUT /auth/profile accepts a partial body; we only send fields that
// actually changed.
//
// Avatar upload is a separate multipart endpoint (POST /auth/profile/image)
// and runs immediately on pick, since uploading a binary alongside other
// fields would require either base64-bloat or a multi-step request.

import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Image, Pressable, ScrollView, View } from 'react-native';
import { errorMessage } from '../src/api/client';
import {
  updateProfile,
  uploadProfileImage,
} from '../src/api/auth';
import { useAuth } from '../src/store/auth';
import { useTheme } from '../src/theme';
import {
  BodyStrong,
  Button,
  Card,
  Caption,
  Input,
  Screen,
  SectionHeader,
  Small,
} from '../src/ui';

export default function EditProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const bootstrap = useAuth((s) => s.bootstrap);

  const [first, setFirst] = useState(user?.firstName ?? '');
  const [last, setLast] = useState(user?.lastName ?? '');
  const [phone, setPhone] = useState(user?.phone ?? '');
  const [busy, setBusy] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(user?.profileImageUrl ?? null);

  const initials = `${(first?.[0] ?? '?').toUpperCase()}${(last?.[0] ?? '').toUpperCase()}`;

  const pickAvatar = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) {
        Alert.alert(
          'Permission needed',
          'We need access to your photos to set an avatar.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      setAvatarBusy(true);
      try {
        const updated = await uploadProfileImage({
          uri: asset.uri,
          name: asset.fileName ?? 'avatar.jpg',
          type: asset.mimeType ?? 'image/jpeg',
        });
        const next = updated?.profileImageUrl ?? asset.uri;
        setAvatarPreview(next);
        await bootstrap(); // refresh user in the store
      } catch (e) {
        Alert.alert('Upload failed', errorMessage(e));
      } finally {
        setAvatarBusy(false);
      }
    } catch (e) {
      Alert.alert('Failed', errorMessage(e));
    }
  };

  const save = async () => {
    const patch = {};
    if (first.trim() && first !== user?.firstName) patch.firstName = first.trim();
    if (last !== (user?.lastName ?? '')) patch.lastName = last.trim();
    if (phone !== (user?.phone ?? '')) patch.phone = phone.trim() || undefined;

    if (Object.keys(patch).length === 0) {
      router.back();
      return;
    }
    setBusy(true);
    try {
      await updateProfile(patch);
      await bootstrap();
      router.back();
    } catch (e) {
      Alert.alert('Save failed', errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['bottom']}>
      <ScrollView contentContainerStyle={{ padding: t.spacing.s5, gap: t.spacing.s4 }}>
        <View style={{ alignItems: 'center', marginVertical: t.spacing.s3 }}>
          <Pressable onPress={pickAvatar} disabled={avatarBusy}>
            <View
              style={{
                width: 96,
                height: 96,
                borderRadius: 48,
                backgroundColor: t.colors.primary,
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                opacity: avatarBusy ? 0.6 : 1,
              }}
            >
              {avatarPreview ? (
                <Image
                  source={{ uri: avatarPreview }}
                  style={{ width: '100%', height: '100%' }}
                />
              ) : (
                <BodyStrong color="#fff" style={{ fontSize: 32, fontWeight: '700' }}>
                  {initials}
                </BodyStrong>
              )}
            </View>
            <View
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 32,
                height: 32,
                borderRadius: 16,
                backgroundColor: t.colors.card,
                borderWidth: 2,
                borderColor: t.colors.border,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="camera" size={16} color={t.colors.primary} />
            </View>
          </Pressable>
          <Small style={{ marginTop: t.spacing.s2 }}>Tap photo to change</Small>
        </View>

        <View>
          <SectionHeader title="Identity" />
          <Card padding="s4">
            <Input label="First name" value={first} onChangeText={setFirst} placeholder="First name" />
            <Input label="Last name" value={last} onChangeText={setLast} placeholder="Last name" />
            <Input
              label="Phone"
              value={phone}
              onChangeText={setPhone}
              placeholder="+1 555 0123"
              keyboardType="phone-pad"
            />
            <Caption>Email and role can only be changed by an administrator.</Caption>
          </Card>
        </View>

        <Button label="Save changes" loading={busy} onPress={save} fullWidth />
      </ScrollView>
    </Screen>
  );
}

