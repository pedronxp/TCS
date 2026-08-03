import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { ComponentSize, Spacing, SpacingAlias } from '../../constants/Spacing';
import { Badge, BadgeVariant } from './Badge';

type FeatherName = React.ComponentProps<typeof Feather>['name'];

export interface ModuleCardProps {
  title: string;
  description: string;
  icon: FeatherName;
  onPress: () => void;
  badge?: string;
  badgeVariant?: BadgeVariant;
  testID?: string;
}

export function ModuleCard({ title, description, icon, onPress, badge, badgeVariant = 'info', testID }: ModuleCardProps) {
  const { theme } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}`}
      style={({ pressed }) => [
        styles.container,
        { backgroundColor: theme.surface, borderColor: pressed ? theme.accent : theme.border },
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.top}>
        <View style={[styles.icon, { backgroundColor: theme.secondary }]}>
          <Feather name={icon} size={24} color={theme.primary} />
        </View>
        {badge ? <Badge label={badge} variant={badgeVariant} size="sm" /> : null}
      </View>
      <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
      <Text style={[styles.description, { color: theme.textSecondary }]} numberOfLines={2}>{description}</Text>
      <Feather name="arrow-up-right" size={18} color={theme.primary} style={styles.arrow} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { minHeight: 152, borderWidth: 1, borderRadius: SpacingAlias.radiusLg, padding: Spacing[4] },
  pressed: { opacity: 0.9, transform: [{ scale: 0.99 }] },
  top: { minHeight: ComponentSize.buttonSm, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  icon: { width: ComponentSize.buttonSm, height: ComponentSize.buttonSm, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  title: { marginTop: Spacing[3], fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  description: { marginTop: Spacing[1], paddingRight: Spacing[5], fontSize: FontSize.xs, lineHeight: 17 },
  arrow: { position: 'absolute', right: Spacing[4], bottom: Spacing[4] },
});
