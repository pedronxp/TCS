import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';
import { Button, ButtonVariant } from './Button';

export interface ConfirmSheetAction {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
}

export interface ConfirmSheetProps {
  visible: boolean;
  title: string;
  description?: string;
  actions: ConfirmSheetAction[];
  onDismiss: () => void;
}

export function ConfirmSheet({ visible, title, description, actions, onDismiss }: ConfirmSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.root}>
        <Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onDismiss} accessibilityLabel="Fechar confirmação" />
        <View style={[styles.sheet, { backgroundColor: theme.background, paddingBottom: Math.max(insets.bottom, Spacing[4]) }]}>
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {description ? <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text> : null}
          <View style={styles.actions}>
            {actions.map((action) => (
              <Button
                key={action.label}
                label={action.label}
                onPress={action.onPress}
                variant={action.variant}
                disabled={action.disabled}
                fullWidth
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFillObject },
  sheet: { borderTopLeftRadius: SpacingAlias.radiusXl, borderTopRightRadius: SpacingAlias.radiusXl, paddingHorizontal: Spacing[5], paddingTop: Spacing[3] },
  handle: { alignSelf: 'center', width: 52, height: 5, borderRadius: 3, marginBottom: Spacing[5] },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  description: { marginTop: Spacing[2], fontSize: FontSize.base, lineHeight: 21 },
  actions: { gap: Spacing[2], marginTop: Spacing[5] },
});
