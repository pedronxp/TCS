import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { ComponentSize, Spacing } from '../../constants/Spacing';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export interface AppHeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  actionIcon?: FeatherName;
  actionLabel?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export function AppHeader({
  title,
  subtitle,
  onBack,
  actionIcon,
  actionLabel,
  onAction,
  style,
}: AppHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, { borderBottomColor: theme.border }, style]}>
      {onBack ? (
        <Pressable
          onPress={onBack}
          style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: theme.secondary }]}
          accessibilityRole="button"
          accessibilityLabel="Voltar"
        >
          <Feather name="arrow-left" size={22} color={theme.text} />
        </Pressable>
      ) : null}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {onAction && actionIcon ? (
        <Pressable
          onPress={onAction}
          style={({ pressed }) => [styles.iconButton, pressed && { backgroundColor: theme.secondary }]}
          accessibilityRole="button"
          accessibilityLabel={actionLabel ?? 'Ação'}
        >
          <Feather name={actionIcon} size={21} color={theme.primary} />
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
    borderBottomWidth: 1,
    paddingHorizontal: Spacing[2],
  },
  iconButton: {
    width: ComponentSize.buttonMd,
    height: ComponentSize.buttonMd,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  subtitle: { marginTop: 2, fontSize: FontSize.xs },
});
