import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  TextInput, ActivityIndicator, Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { generateUUID } from '../../../utils/uuid';
import { notificarNovaAtribuicao } from '../../../services/NotificationService';

const PRIORIDADES = [
  { key: 'baixa', label: 'Baixa', color: '#3B82F6' },
  { key: 'media', label: 'Média', color: '#F59E0B' },
  { key: 'alta', label: 'Alta', color: '#EF4444' },
];

interface Agente {
  uid: string;
  name: string;
}

export default function CriarAtribuicaoScreen() {
  const { theme } = useTheme();
  const [agentes, setAgentes] = useState<Agente[]>([]);
  const [agenteId, setAgenteId] = useState('');
  const [prioridade, setPrioridade] = useState('media');
  const [endereco, setEndereco] = useState('');
  const [numero, setNumero] = useState('');
  const [bairro, setBairro] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [saving, setSaving] = useState(false);
  const [showAgentes, setShowAgentes] = useState(false);
  const [supervisorUid, setSupervisorUid] = useState('');
  const [municipio, setMunicipio] = useState('');

  useEffect(() => { loadAgentes(); }, []);

  const loadAgentes = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data: user } = await supabase
        .from('users').select('municipio, uid').eq('uid', session.user.id).single();
      if (!user) return;
      setSupervisorUid(user.uid);
      setMunicipio(user.municipio);

      const { data } = await supabase
        .from('users')
        .select('uid, name')
        .eq('municipio', user.municipio)
        .eq('role', 'agent')
        .eq('isApproved', true)
        .order('name');

      setAgentes(data || []);
    } catch (e) {
      logger.error('system', 'Erro ao carregar agentes', { erro: String(e) });
    }
  };

  const enderecoCompleto = [endereco, numero, bairro].filter(Boolean).join(', ');

  const handleSalvar = async () => {
    if (!endereco.trim()) { Alert.alert('Atenção', 'Informe o endereço.'); return; }
    if (!agenteId) { Alert.alert('Atenção', 'Selecione um agente.'); return; }

    setSaving(true);
    try {
      const agenteSelecionado = agentes.find(a => a.uid === agenteId);

      const { error } = await supabase.from('atribuicoes').insert({
        id: generateUUID(),
        supervisor_uid: supervisorUid,
        agente_uid: agenteId,
        agente_nome: agenteSelecionado?.name || '',
        municipio,
        endereco_completo: enderecoCompleto,
        observacao: observacoes.trim() || null,
        prioridade,
        status: 'pendente',
        criada_em: new Date().toISOString(),
      });

      if (error) throw error;

      try {
        await notificarNovaAtribuicao(enderecoCompleto, prioridade);
      } catch (notifErr) {
        logger.warn('system', 'Falha ao notificar agente, mas atribuição criada', { erro: String(notifErr) });
      }

      Alert.alert('Atribuição Criada', 'Missão atribuída com sucesso!', [
        { text: 'OK', onPress: () => router.back() }
      ]);
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível criar a atribuição.');
      logger.error('system', 'Erro atribuição', { erro: String(e) });
    } finally {
      setSaving(false);
    }
  };

  const agenteSelecionado = agentes.find(a => a.uid === agenteId);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Nova Atribuição</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Designar missão para agente</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">

        {/* Endereço */}
        <Text style={[styles.label, { color: theme.textSecondary }]}>LOCAL DA OCORRÊNCIA</Text>
        <View style={[styles.inputRow, { borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
          <Feather name="map-pin" size={16} color={theme.textSecondary} />
          <TextInput
            style={[styles.input, { color: theme.text }]}
            value={endereco}
            onChangeText={setEndereco}
            placeholder="Rua / Avenida"
            placeholderTextColor={theme.textSecondary}
          />
        </View>
        <View style={styles.twoCol}>
          <View style={[styles.inputRow, styles.flex1, { borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={numero}
              onChangeText={setNumero}
              placeholder="Nº"
              placeholderTextColor={theme.textSecondary}
              keyboardType="numeric"
            />
          </View>
          <View style={[styles.inputRow, styles.flex2, { borderColor: theme.border, backgroundColor: theme.surfaceHighlight }]}>
            <TextInput
              style={[styles.input, { color: theme.text }]}
              value={bairro}
              onChangeText={setBairro}
              placeholder="Bairro"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        </View>

        {/* Prioridade */}
        <Text style={[styles.label, { color: theme.textSecondary }]}>PRIORIDADE</Text>
        <View style={styles.prioridadeRow}>
          {PRIORIDADES.map(p => (
            <TouchableOpacity
              key={p.key}
              style={[
                styles.prioridadeBtn,
                prioridade === p.key
                  ? { backgroundColor: p.color, borderColor: p.color }
                  : { backgroundColor: theme.surfaceHighlight, borderColor: theme.border },
              ]}
              onPress={() => setPrioridade(p.key)}
            >
              <Feather name="flag" size={14} color={prioridade === p.key ? '#FFF' : p.color} />
              <Text style={[styles.prioridadeText, { color: prioridade === p.key ? '#FFF' : theme.text }]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Agente */}
        <Text style={[styles.label, { color: theme.textSecondary }]}>DESIGNAR PARA</Text>
        <TouchableOpacity
          style={[styles.selectorBtn, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
          onPress={() => setShowAgentes(!showAgentes)}
        >
          <Feather name="user" size={16} color={theme.textSecondary} />
          <Text style={[styles.selectorText, { color: agenteSelecionado ? theme.text : theme.textSecondary }]}>
            {agenteSelecionado?.name || 'Selecionar agente...'}
          </Text>
          <Feather name={showAgentes ? 'chevron-up' : 'chevron-down'} size={16} color={theme.textSecondary} />
        </TouchableOpacity>

        {showAgentes && (
          <View style={[styles.dropdownList, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
            {agentes.length === 0 ? (
              <Text style={[styles.dropdownEmpty, { color: theme.textSecondary }]}>Nenhum agente disponível.</Text>
            ) : (
              agentes.map(a => (
                <TouchableOpacity
                  key={a.uid}
                  style={[
                    styles.dropdownItem,
                    { borderBottomColor: theme.border },
                    agenteId === a.uid && { backgroundColor: `${theme.primary}15` },
                  ]}
                  onPress={() => { setAgenteId(a.uid); setShowAgentes(false); }}
                >
                  <View style={[styles.dropdownAvatar, { backgroundColor: theme.primary }]}>
                    <Text style={styles.dropdownAvatarText}>{a.name[0]?.toUpperCase()}</Text>
                  </View>
                  <Text style={[styles.dropdownName, { color: theme.text }]}>{a.name}</Text>
                  {agenteId === a.uid && <Feather name="check" size={16} color={theme.primary} />}
                </TouchableOpacity>
              ))
            )}
          </View>
        )}

        {/* Observações */}
        <Text style={[styles.label, { color: theme.textSecondary }]}>OBSERVAÇÕES (OPCIONAL)</Text>
        <View style={[styles.textAreaWrapper, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
          <TextInput
            style={[styles.textArea, { color: theme.text }]}
            value={observacoes}
            onChangeText={setObservacoes}
            placeholder="Detalhes adicionais sobre a ocorrência, acesso ao local, etc."
            placeholderTextColor={theme.textSecondary}
            multiline
            numberOfLines={4}
            textAlignVertical="top"
          />
        </View>

        {/* Preview do endereço */}
        {enderecoCompleto ? (
          <View style={[styles.previewCard, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}>
            <Feather name="map-pin" size={16} color={theme.primary} />
            <Text style={[styles.previewText, { color: theme.text }]}>{enderecoCompleto}</Text>
          </View>
        ) : null}

        <TouchableOpacity
          style={[styles.submitBtn, { backgroundColor: saving ? theme.textSecondary : theme.primary }]}
          onPress={handleSalvar}
          disabled={saving}
        >
          {saving
            ? <ActivityIndicator size="small" color="#FFF" />
            : <Feather name="send" size={20} color="#FFF" />
          }
          <Text style={styles.submitText}>{saving ? 'Criando...' : 'Confirmar Missão'}</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingTop: 60, paddingBottom: 20, paddingHorizontal: 24,
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
  },
  backButton: {
    width: 44, height: 44, justifyContent: 'center', alignItems: 'center',
    borderRadius: 12, borderWidth: 1, marginRight: 16,
  },
  title: { fontSize: 22, fontWeight: '700' },
  subtitle: { fontSize: 12, fontWeight: '500', marginTop: 2 },
  scrollContent: { padding: 24, paddingBottom: 60 },
  label: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1,
    textTransform: 'uppercase', marginBottom: 10, marginTop: 20,
  },
  inputRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14,
    height: 52, marginBottom: 10,
  },
  input: { flex: 1, fontSize: 15 },
  twoCol: { flexDirection: 'row', gap: 10 },
  flex1: { flex: 1 },
  flex2: { flex: 2 },
  prioridadeRow: { flexDirection: 'row', gap: 10 },
  prioridadeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 6, paddingVertical: 12, borderRadius: 12, borderWidth: 1.5,
  },
  prioridadeText: { fontSize: 14, fontWeight: '700' },
  selectorBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, height: 52,
  },
  selectorText: { flex: 1, fontSize: 15 },
  dropdownList: {
    borderRadius: 14, borderWidth: 1, overflow: 'hidden', marginTop: -6, marginBottom: 10,
  },
  dropdownItem: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1,
  },
  dropdownAvatar: {
    width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center',
  },
  dropdownAvatarText: { color: '#FFF', fontWeight: '700', fontSize: 14 },
  dropdownName: { flex: 1, fontSize: 15, fontWeight: '600' },
  dropdownEmpty: { padding: 20, fontSize: 14, textAlign: 'center' },
  textAreaWrapper: {
    borderRadius: 14, borderWidth: 1, padding: 14, minHeight: 100,
  },
  textArea: { fontSize: 15, lineHeight: 22 },
  previewCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 14, marginTop: 12,
  },
  previewText: { flex: 1, fontSize: 14, fontWeight: '600' },
  submitBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 12, height: 60, borderRadius: 16, marginTop: 32,
  },
  submitText: { color: '#FFF', fontSize: 16, fontWeight: '700' },
});
