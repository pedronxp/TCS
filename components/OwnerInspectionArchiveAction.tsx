import React, { useRef, useState } from 'react';
import { Modal, Pressable, Text, TextInput, View } from 'react-native';
import { supabase } from '../utils/supabase';
import { useTheme } from '../context/ThemeContext';
import { ownerActionError, ownerMutation } from '../services/OwnerAdministrationService';
import { generateUUID } from '../utils/uuid';

export function OwnerInspectionArchiveAction({ inspectionId, archived, onUpdated }: {
  inspectionId: string; archived: boolean; onUpdated: () => void | Promise<void>;
}) {
  const { theme } = useTheme();
  const [visible, setVisible] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  const [needsMfa, setNeedsMfa] = useState(false);
  const lock = useRef(false);
  const operation = useRef('');
  const execute = async () => {
    if (lock.current || reason.trim().length < 8) return;
    lock.current = true; setBusy(true); setError(null);
    try {
      await ownerMutation('set_owner_inspection_archived', { p_inspection_id: inspectionId, p_archived: !archived }, reason, operation.current);
      setVisible(false);
      await onUpdated();
    } catch (cause) {
      if (cause instanceof Error && cause.message.includes('aal2')) {
        setNeedsMfa(true);
        setError('Digite o código do seu autenticador para continuar.');
      } else setError(ownerActionError(cause));
    }
    finally { lock.current = false; setBusy(false); }
  };
  const verify = async () => {
    if (lock.current || !/^\d{6}$/.test(code)) return;
    lock.current = true;
    setBusy(true);
    try {
      const { data, error: listError } = await supabase.auth.mfa.listFactors();
      if (listError) throw listError;
      const factor = data.totp.find(item => item.status === 'verified');
      if (!factor) throw new Error('Configure um autenticador na segurança da conta para continuar.');
      const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId: factor.id, code });
      if (verifyError) throw verifyError;
      setNeedsMfa(false);
      setError(null);
    } catch (cause) { setError(ownerActionError(cause)); }
    finally { setCode(''); lock.current = false; setBusy(false); }
  };
  const action = (label: string, onPress: () => void, disabled = false) => <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={{ padding: 14, opacity: disabled ? 0.5 : 1 }}><Text style={{ color: theme.text, fontWeight: '700' }}>{label}</Text></Pressable>;
  return <View>
    {action(archived ? 'Restaurar vistoria' : 'Excluir vistoria', () => { operation.current = generateUUID(); setReason(''); setError(null); setCode(''); setNeedsMfa(false); setVisible(true); })}
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => { if (!busy) setVisible(false); }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: theme.overlay }}>
        <View style={{ backgroundColor: theme.surface, borderRadius: 20, padding: 20, gap: 12 }}>
          <Text style={{ color: theme.text, fontSize: 20, fontWeight: '700' }}>{archived ? 'Restaurar vistoria arquivada' : 'Excluir por arquivamento'}</Text>
          <Text style={{ color: theme.textSecondary }}>A exclusão é reversível. Documentos, evidências e histórico permanecem preservados. A ação exige confirmação administrativa e fica registrada.</Text>
          <TextInput accessibilityLabel="Motivo do arquivamento" placeholder="Motivo (mínimo de 8 caracteres)" value={reason} onChangeText={value => { if (value !== reason) operation.current = generateUUID(); setReason(value); }} maxLength={500} multiline editable={!busy} style={{ color: theme.text, borderColor: theme.border, borderWidth: 1, borderRadius: 12, padding: 12, minHeight: 80 }} />
          {error ? <Text accessibilityRole="alert" style={{ color: theme.error }}>{error}</Text> : null}
          {needsMfa ? <>
            <TextInput accessibilityLabel="Código do autenticador" keyboardType="number-pad" value={code} onChangeText={setCode} maxLength={6} editable={!busy} style={{ color: theme.text, borderColor: theme.border, borderWidth: 1, borderRadius: 12, padding: 12 }} />
            {action('Confirmar segundo fator', () => void verify(), busy || !/^\d{6}$/.test(code))}
          </> : null}
          {action(busy ? 'Salvando...' : archived ? 'Confirmar restauração' : 'Confirmar exclusão reversível', () => void execute(), busy || needsMfa || reason.trim().length < 8)}
          {action('Cancelar', () => setVisible(false), busy)}
        </View>
      </View>
    </Modal>
  </View>;
}
