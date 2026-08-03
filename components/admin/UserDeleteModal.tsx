import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

interface UserDeleteImpact {
  vistorias: number;
  agendamentosCriados: number;
  agendamentosComoAgente: number;
  atribuicoesComoSupervisor: number;
  atribuicoesComoAgente: number;
}

interface UserDeleteModalProps {
  visible: boolean;
  user: {
    name?: string;
    role?: string;
    email?: string;
    municipio?: string;
  } | null;
  reason: string;
  onReasonChange: (reason: string) => void;
  impact: UserDeleteImpact | null;
  impactError: string | null;
  loadingImpact: boolean;
  deleting: boolean;
  deleteVistorias: boolean;
  onDeleteVistoriasChange: (value: boolean) => void;
  confirmDisabled: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export function UserDeleteModal({
  visible,
  user,
  reason,
  onReasonChange,
  impact,
  impactError,
  loadingImpact,
  deleting,
  deleteVistorias,
  onDeleteVistoriasChange,
  confirmDisabled,
  onCancel,
  onConfirm,
}: UserDeleteModalProps) {
  const { theme } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={[styles.overlay, { backgroundColor: theme.overlay }]}
      >
        <View style={[styles.sheet, { backgroundColor: theme.background, borderColor: theme.border }]}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            <View style={[styles.iconWrap, { backgroundColor: theme.errorLight }]}>
              <Feather name="trash-2" size={24} color={theme.error} />
            </View>
            <Text style={[styles.title, { color: theme.text }]}>Excluir usuario</Text>
            <Text style={[styles.description, { color: theme.textSecondary }]}>
              {user?.name || 'Usuario'} sera removido do municipio {user?.municipio || '-'}.
            </Text>

            {loadingImpact ? (
              <ActivityIndicator color={theme.primary} style={styles.loading} />
            ) : impactError ? (
              <Text style={[styles.error, { color: theme.error }]}>{impactError}</Text>
            ) : impact ? (
              <View style={[styles.impactBox, { borderColor: theme.border }]}>
                <Text style={[styles.impactText, { color: theme.textSecondary }]}>
                  Vistorias: {impact.vistorias}
                </Text>
                <Text style={[styles.impactText, { color: theme.textSecondary }]}>
                  Agendamentos: {impact.agendamentosCriados + impact.agendamentosComoAgente}
                </Text>
                <Text style={[styles.impactText, { color: theme.textSecondary }]}>
                  Atribuicoes: {impact.atribuicoesComoSupervisor + impact.atribuicoesComoAgente}
                </Text>
              </View>
            ) : null}

            <View style={styles.switchRow}>
              <Text style={[styles.switchText, { color: theme.text }]}>Excluir vistorias vinculadas</Text>
              <Switch value={deleteVistorias} onValueChange={onDeleteVistoriasChange} />
            </View>

            <TextInput
              style={[styles.reasonInput, { borderColor: theme.border, color: theme.text }]}
              value={reason}
              onChangeText={onReasonChange}
              placeholder="Motivo da exclusao"
              placeholderTextColor={theme.textSecondary}
              multiline
            />

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: theme.surfaceHighlight }]}
                onPress={onCancel}
                disabled={deleting}
              >
                <Text style={[styles.cancelText, { color: theme.text }]}>Cancelar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: confirmDisabled ? theme.muted : theme.error }]}
                onPress={onConfirm}
                disabled={confirmDisabled || deleting}
              >
                <Text style={styles.confirmText}>{deleting ? 'Excluindo...' : 'Excluir'}</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
  },
  sheet: {
    maxHeight: '88%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  content: {
    padding: 20,
  },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  loading: {
    marginVertical: 12,
  },
  error: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 12,
  },
  impactBox: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    gap: 4,
    marginBottom: 14,
  },
  impactText: {
    fontSize: 13,
    fontWeight: '600',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  switchText: {
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    marginRight: 12,
  },
  reasonInput: {
    minHeight: 84,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelText: {
    fontSize: 14,
    fontWeight: '800',
  },
  confirmText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '800',
  },
});
