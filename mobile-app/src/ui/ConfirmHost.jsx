// ConfirmHost — renders the active confirm()/notify() dialog as a themed
// modal. Mount once near the app root. Reads the dialog from the confirm
// store and resolves its promise on action / dismiss.

import { Ionicons } from '@expo/vector-icons';
import { Modal, Pressable, View } from 'react-native';
import { useTheme } from '../theme';
import { Button } from './Button';
import { useConfirmStore } from './confirm';
import { Body, H3 } from './Text';

export function ConfirmHost() {
  const t = useTheme();
  const dialog = useConfirmStore((s) => s.dialog);
  const close = useConfirmStore((s) => s.close);

  if (!dialog) return null;

  const isConfirm = dialog.mode === 'confirm';
  // Result for a backdrop/back dismiss: false for confirms (treated as
  // cancel), undefined for plain notices.
  const dismissValue = isConfirm ? false : undefined;

  const finish = (result) => {
    dialog.resolve?.(result);
    close();
  };

  const accent = dialog.destructive ? t.colors.error : t.colors.primary;

  return (
    <Modal
      transparent
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => finish(dismissValue)}
    >
      {/* Scrim — tap to dismiss. 50% black reads correctly in both themes. */}
      <Pressable
        onPress={() => finish(dismissValue)}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
          alignItems: 'center',
          justifyContent: 'center',
          padding: t.spacing.s6,
        }}
      >
        {/* Card — swallow taps so they don't bubble to the scrim. */}
        <Pressable
          onPress={() => {}}
          style={{
            width: '100%',
            maxWidth: 400,
            backgroundColor: t.colors.card,
            borderRadius: t.radius.xl,
            borderWidth: 1,
            borderColor: t.colors.border,
            padding: t.spacing.s5,
            gap: t.spacing.s3,
            shadowColor: t.colors.shadow,
            shadowOpacity: 0.3,
            shadowRadius: 24,
            shadowOffset: { width: 0, height: 8 },
            elevation: 12,
          }}
        >
          {dialog.icon ? (
            <View
              style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: dialog.destructive ? t.colors.errorTint : t.colors.primaryTint,
              }}
            >
              <Ionicons name={dialog.icon} size={24} color={accent} />
            </View>
          ) : null}

          {dialog.title ? <H3>{dialog.title}</H3> : null}
          {dialog.message ? (
            <Body color={t.colors.textSecondary}>{dialog.message}</Body>
          ) : null}

          <View style={{ flexDirection: 'row', gap: t.spacing.s2, marginTop: t.spacing.s2 }}>
            {isConfirm ? (
              <Button
                label={dialog.cancelLabel}
                variant="secondary"
                onPress={() => finish(false)}
                style={{ flex: 1 }}
              />
            ) : null}
            <Button
              label={dialog.confirmLabel}
              variant={dialog.destructive ? 'danger' : 'primary'}
              onPress={() => finish(isConfirm ? true : undefined)}
              style={{ flex: 1 }}
            />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
