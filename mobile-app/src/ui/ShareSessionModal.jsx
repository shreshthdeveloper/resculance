// ShareSessionModal — mobile counterpart to the web's ShareSessionModal.
// Surfaces the public, read-only link to a session (`${WEB_URL}/sessions/:id`)
// as a scannable QR plus the system share sheet. The link is PIN-gated: a
// superadmin enables sharing and sets the access PIN under
// Settings → Public Sharing, after which viewers are prompted for it.

import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Modal, Pressable, Share, View } from 'react-native';
import { WEB_URL } from '../lib/config';
import { shadow, useTheme } from '../theme';
import { Button } from './Button';
import { Body, Caption, H3, Small } from './Text';

export function ShareSessionModal({ visible, onClose, sessionId, sessionCode }) {
  const t = useTheme();
  if (!sessionId) return null;

  const shareUrl = `${WEB_URL.replace(/\/$/, '')}/sessions/${sessionId}`;
  // Rendered server-side by a public QR endpoint so we avoid a native QR
  // dependency. `qzone` adds a quiet border; ecc=M tolerates phone-camera blur.
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=440x440&margin=0&qzone=1&ecc=M&data=${encodeURIComponent(
    shareUrl,
  )}`;

  const onShare = () =>
    Share.share({
      message: sessionCode
        ? `Read-only view of session ${sessionCode}:\n${shareUrl}`
        : shareUrl,
      url: shareUrl,
    }).catch(() => {});

  const onOpen = () => WebBrowser.openBrowserAsync(shareUrl).catch(() => {});

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          justifyContent: 'center',
          padding: t.spacing.s5,
        }}
      >
        {/* Swallow taps inside the card so they don't dismiss the modal. */}
        <Pressable
          onPress={(e) => e.stopPropagation?.()}
          style={[
            {
              backgroundColor: t.colors.card,
              borderRadius: t.radius.xl,
              padding: t.spacing.s5,
              gap: t.spacing.s4,
            },
            shadow(t.colors, 2),
          ]}
        >
          {/* Header */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.s3 }}>
            <View
              style={{
                width: 38,
                height: 38,
                borderRadius: 19,
                backgroundColor: t.colors.primaryTint,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="share-social" size={19} color={t.colors.primary} />
            </View>
            <H3 style={{ flex: 1 }}>Share session</H3>
            <Pressable hitSlop={10} onPress={onClose}>
              <Ionicons name="close" size={22} color={t.colors.textSecondary} />
            </Pressable>
          </View>

          <Body color={t.colors.textSecondary}>
            Anyone with this link can open a{' '}
            <Body color={t.colors.text} weight={t.fontFamily.bodySemibold}>
              read-only
            </Body>{' '}
            view of{' '}
            {sessionCode ? (
              <Body color={t.colors.primary} weight={t.fontFamily.bodySemibold}>
                {sessionCode}
              </Body>
            ) : (
              'this session'
            )}
            . If an access PIN is required, viewers are prompted for it.
          </Body>

          {/* QR */}
          <View style={{ alignItems: 'center' }}>
            <View
              style={{
                padding: t.spacing.s4,
                backgroundColor: '#FFFFFF',
                borderRadius: t.radius.xl,
                borderWidth: 1,
                borderColor: t.colors.border,
              }}
            >
              <Image
                source={{ uri: qrSrc }}
                style={{ width: 188, height: 188 }}
                contentFit="contain"
                transition={150}
              />
            </View>
          </View>

          {/* Link */}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: t.spacing.s2,
              backgroundColor: t.colors.surfaceAlt,
              borderRadius: t.radius.lg,
              paddingHorizontal: t.spacing.s3,
              paddingVertical: t.spacing.s3,
            }}
          >
            <Ionicons name="link" size={16} color={t.colors.textSecondary} />
            <Small color={t.colors.text} numberOfLines={1} style={{ flex: 1 }}>
              {shareUrl}
            </Small>
          </View>

          {/* PIN note */}
          <View
            style={{
              flexDirection: 'row',
              gap: t.spacing.s2,
              alignItems: 'flex-start',
              backgroundColor: t.colors.infoTint,
              borderRadius: t.radius.lg,
              padding: t.spacing.s3,
            }}
          >
            <Ionicons name="lock-closed" size={15} color={t.colors.info} style={{ marginTop: 1 }} />
            <Caption color={t.colors.textSecondary} style={{ flex: 1 }}>
              Sharing and the access PIN are managed under Settings → Public Sharing
              (superadmin only).
            </Caption>
          </View>

          {/* Actions */}
          <View style={{ flexDirection: 'row', gap: t.spacing.s2 }}>
            <View style={{ flex: 1 }}>
              <Button
                label="Open"
                variant="secondary"
                onPress={onOpen}
                icon={<Ionicons name="open-outline" size={17} color={t.colors.text} />}
                fullWidth
              />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                label="Share link"
                onPress={onShare}
                icon={<Ionicons name="share-outline" size={17} color="#fff" />}
                fullWidth
              />
            </View>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
