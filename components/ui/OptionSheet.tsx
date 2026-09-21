import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../context/ThemeContext';
import { FontSize, FontWeight } from '../../constants/Typography';
import { Spacing, SpacingAlias } from '../../constants/Spacing';

export interface OptionSheetOption {
  key: string;
  title: string;
  subtitle?: string;
  icon?: React.ComponentProps<typeof Feather>['name'];
  selected?: boolean;
  disabled?: boolean;
}

export interface OptionSheetProps {
  visible: boolean;
  title: string;
  description?: string;
  options: OptionSheetOption[];
  onSelect: (key: string) => void;
  onDismiss: () => void;
}

/**
 * Folha inferior de seleção (bottom sheet) com lista de opções.
 * Mesma linguagem visual do ConfirmSheet; usada quando um campo
 * tem muitas opções (tema, ações de documento, nota de QE...).
 */
export function OptionSheet({ visible, title, description, options, onSelect, onDismiss }: OptionSheetProps) {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.root}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: theme.overlay }]}
          onPress={onDismiss}
          accessibilityLabel="Fechar seleção"
        />
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: theme.background,
              paddingBottom: Math.max(insets.bottom, Spacing[4]),
            },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: theme.border }]} />
          <Text style={[styles.title, { color: theme.text }]}>{title}</Text>
          {description ? (
            <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>
          ) : null}

          <ScrollView
            style={styles.optionsScroll}
            bounces={false}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.options}>
              {options.map(option => {
                const selected = option.selected === true;
                return (
                  <Pressable
                    key={option.key}
                    accessibilityRole="button"
                    accessibilityState={{ selected, disabled: option.disabled }}
                    disabled={option.disabled}
                    onPress={() => onSelect(option.key)}
                    style={({ pressed }) => [
                      styles.option,
                      {
                        backgroundColor: selected ? theme.secondary : theme.surface,
                        borderColor: selected ? theme.primary : theme.border,
                        opacity: option.disabled ? 0.5 : pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    {option.icon ? (
                      <View
                        style={[
                          styles.optionIcon,
                          { backgroundColor: selected ? `${theme.primary}1A` : theme.iconBackground },
                        ]}
                      >
                        <Feather
                          name={option.icon}
                          size={17}
                          color={selected ? theme.primary : theme.textSecondary}
                        />
                      </View>
                    ) : null}
                    <View style={styles.optionCopy}>
                      <Text style={[styles.optionTitle, { color: theme.text }]}>{option.title}</Text>
                      {option.subtitle ? (
                        <Text style={[styles.optionSubtitle, { color: theme.textSecondary }]}>
                          {option.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    <Feather
                      name={selected ? 'check-circle' : 'circle'}
                      size={20}
                      color={selected ? theme.primary : theme.border}
                    />
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    borderTopLeftRadius: SpacingAlias.radiusXl,
    borderTopRightRadius: SpacingAlias.radiusXl,
    paddingHorizontal: Spacing[5],
    paddingTop: Spacing[3],
    maxHeight: '82%',
  },
  handle: {
    alignSelf: 'center',
    width: 52,
    height: 5,
    borderRadius: 3,
    marginBottom: Spacing[4],
  },
  title: { fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  description: { marginTop: Spacing[1], fontSize: FontSize.sm, lineHeight: 19 },
  optionsScroll: { marginTop: Spacing[4], flexGrow: 0 },
  options: { gap: Spacing[2] },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[3],
    borderWidth: 1,
    borderRadius: SpacingAlias.radiusLg,
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[3],
    minHeight: 56,
  },
  optionIcon: {
    width: 36,
    height: 36,
    borderRadius: SpacingAlias.radiusMd,
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionCopy: { flex: 1, minWidth: 0 },
  optionTitle: { fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  optionSubtitle: { fontSize: FontSize.xs, lineHeight: 16, marginTop: 1 },
});
