// components/ui/SectionHeader.tsx
import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing } from '../../constants/Spacing';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  /** Texto do link/ação à direita */
  action?: string;
  onAction?: () => void;
  style?: ViewStyle;
}

export const SectionHeader = React.memo(function SectionHeader({
  title,
  subtitle,
  action,
  onAction,
  style,
}: SectionHeaderProps) {
  const { theme } = useTheme();

  return (
    <View style={[styles.container, style]}>
      <View style={styles.left}>
        <Text style={[styles.title, { color: theme.text }]}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
            {subtitle}
          </Text>
        ) : null}
      </View>

      {action && onAction ? (
        <TouchableOpacity onPress={onAction} activeOpacity={0.7}>
          <Text style={[styles.action, { color: theme.primary }]}>
            {action}
          </Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing[3],  // 12
  },
  left: {
    flex: 1,
    gap: Spacing[1],  // 4
  },
  title: {
    fontSize: FontSize.lg,              // 18
    fontWeight: FontWeight.semibold,    // '600'
    lineHeight: FontSize.lg * 1.35,
  },
  subtitle: {
    fontSize: FontSize.sm,   // 12
    fontWeight: FontWeight.regular,
  },
  action: {
    fontSize: FontSize.sm,
    fontWeight: FontWeight.semibold,
  },
});
