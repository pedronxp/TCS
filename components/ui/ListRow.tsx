import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { ComponentSize, Spacing, SpacingAlias } from '../../constants/Spacing';
import { Badge, BadgeVariant } from './Badge';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export interface ListRowProps {
  title: string;
  subtitle?: string;
  icon?: FeatherName;
  badge?: string;
  badgeVariant?: BadgeVariant;
  onPress?: () => void;
  disabled?: boolean;
  testID?: string;
}

export function ListRow({ title, subtitle, icon, badge, badgeVariant = 'neutral', onPress, disabled, testID }: ListRowProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress || disabled}
      testID={testID}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityState={{ disabled: Boolean(disabled) }}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: theme.surface, borderColor: theme.border },
        pressed && { backgroundColor: theme.secondary },
        disabled && { opacity: theme.disabledOpacity },
      ]}
    >
      {icon ? (
        <View style={[styles.icon, { backgroundColor: theme.secondary }]}>
          <Feather name={icon} size={20} color={theme.primary} />
        </View>
      ) : null}
      <View style={styles.copy}>
        <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[styles.subtitle, { color: theme.textSecondary }]} numberOfLines={2}>{subtitle}</Text> : null}
      </View>
      {badge ? <Badge label={badge} variant={badgeVariant} size="sm" /> : null}
      {onPress ? <Feather name="chevron-right" size={20} color={theme.textSecondary} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    borderWidth: 1,
    borderRadius: SpacingAlias.radiusMd,
    padding: Spacing[3],
  },
  icon: {
    width: ComponentSize.buttonSm,
    height: ComponentSize.buttonSm,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: { flex: 1 },
  title: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  subtitle: { marginTop: 3, fontSize: FontSize.xs, lineHeight: 16 },
});
