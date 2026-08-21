import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, ScrollView,
  ActivityIndicator, Alert, Modal, Share, TextInput
} from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { supabase } from '../../../utils/supabase';
import { logger } from '../../../utils/logger';
import { registrarAuditoria } from '../../../utils/auditLogger';
import { notificarMasterTokenGerado, notificarMasterSolicitaTokens } from '../../../services/NotificationService';
import { AppHeader, Button, FormField, StateBanner } from '../../../components/ui';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';

const ROLES_LIST = [
  { key: 'agent', label: 'Agente', desc: 'Realiza vistorias em campo', icon: 'clipboard' as const },
  { key: 'supervisor', label: 'Supervisor', desc: 'Gerencia equipe e atribuições', icon: 'users' as const },
  { key: 'admin', label: 'Administrador', desc: 'Acesso total ao município', icon: 'shield' as const },
];

const DURACOES = [
  { key: '24', label: '24h', horas: 24 },
  { key: '48', label: '48h', horas: 48 },
  { key: '168', label: '7 dias', horas: 168 },
  { key: '720', label: '30 dias', horas: 720 },
  { key: 'custom', label: 'Personalizado', horas: 0 },
];

function formatarExpiracao(horas: number): string {
  const expira = new Date(Date.now() + horas * 3600000);
  return expira.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function GerarTokenScreen() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomPad = useBottomTabPadding();
  const { profile } = useAuth();
  const isMasterAdmin = profile?.role === 'master_admin';
  const [role, setRole] = useState('agent');
  const [municipio, setMunicipio] = useState(isMasterAdmin ? '' : (profile?.municipio || ''));
  const [municipioSearch, setMunicipioSearch] = useState('');
  const [duracao, setDuracao] = useState('48');
  const [gerando, setGerando] = useState(false);
  const [tokenGerado, setTokenGerado] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [usadoMes, setUsadoMes] = useState(0);
  const [limiteTotal, setLimiteTotal] = useState(20);
  const [municipios, setMunicipios] = useState<string[]>([]);
  const [loadingMunicipios, setLoadingMunicipios] = useState(false);
  const [solicitando, setSolicitando] = useState(false);
  const [solicitacaoEnviada, setSolicitacaoEnviada] = useState(false);
  // Data/hora customizada (formato dd/mm/aaaa e hh:mm)
  const hoje = new Date();
  const [customData, setCustomData] = useState(
    `${String(hoje.getDate()).padStart(2,'0')}/${String(hoje.getMonth()+1).padStart(2,'0')}/${hoje.getFullYear()}`
  );
  const [customHora, setCustomHora] = useState('23:59');
  const [customErro, setCustomErro] = useState<string | null>(null);

  useEffect(() => {
    if (!isMasterAdmin) return;
    setLoadingMunicipios(true);
    supabase.from('municipios').select('nome').order('nome').then(({ data }) => {
      setMunicipios((data ?? []).map((m: { nome: string }) => m.nome));
      setLoadingMunicipios(false);
    });
  }, [isMasterAdmin]);

  useEffect(() => {
    if (!profile?.uid || isMasterAdmin) return;
    // Carregar limite do usuário e uso no mês atual
    const inicioMes = new Date();
    inicioMes.setDate(1); inicioMes.setHours(0, 0, 0, 0);
    Promise.all([
      supabase.from('invite_tokens').select('*', { count: 'exact', head: true })
        .eq('criadoPor', profile.uid)
        .gte('criadoEm', inicioMes.toISOString()),
    ]).then(([countRes]) => {
      if (typeof profile.tokenLimit === 'number') setLimiteTotal(profile.tokenLimit);
      if (typeof countRes.count === 'number') setUsadoMes(countRes.count);
    }).catch(() => {});
  }, [profile?.uid, profile?.tokenLimit, isMasterAdmin]);

  const roles = ROLES_LIST;

  // Para duração customizada, calcula horas até a data/hora informada
  const calcularHorasCustom = (): number | null => {
    try {
      const [dia, mes, ano] = customData.split('/').map(Number);
      const [hora, min] = customHora.split(':').map(Number);
      if ([dia, mes, ano, hora, min].some(isNaN)) return null;
      const alvo = new Date(ano, mes - 1, dia, hora, min, 0);
      const diff = (alvo.getTime() - Date.now()) / 3600000;
      return diff > 0 ? diff : null;
    } catch { return null; }
  };

  const horasSelecionadas = duracao === 'custom'
    ? (calcularHorasCustom() ?? 48)
    : (DURACOES.find(d => d.key === duracao)?.horas ?? 48);
  const labelDuracao = duracao === 'custom'
    ? `até ${customData} ${customHora}`
    : (DURACOES.find(d => d.key === duracao)?.label ?? '48h');

  const gerarToken = async () => {
    if (!municipio) {
      Alert.alert('Município obrigatório', 'Selecione para qual município este token é válido.');
      return;
    }
    if (duracao === 'custom') {
      const horas = calcularHorasCustom();
      if (!horas) {
        setCustomErro('Data/hora inválida ou já passou. Informe uma data futura.');
        return;
      }
      setCustomErro(null);
    }
    if (!isMasterAdmin && usadoMes >= limiteTotal) {
      Alert.alert(
        'Limite mensal atingido',
        `Você já usou ${usadoMes} de ${limiteTotal} tokens este mês. Solicite ao Master Admin para aumentar seu limite.`,
      );
      return;
    }
    setGerando(true);
    try {
      const { data, error } = await supabase.rpc('create_legacy_invite_token', {
        p_role: role,
        p_municipio: municipio || profile?.municipio || '',
        p_expires_in_hours: Math.round(horasSelecionadas),
      });
      if (error) throw error;
      const codigo = (data as { codigo?: string } | null)?.codigo;
      if (!codigo) throw new Error('Resposta inválida ao gerar token.');

      registrarAuditoria({
        acao: 'token_gerado',
        adminUid: profile?.uid ?? '',
        adminNome: profile?.name ?? '',
        municipio: municipio || profile?.municipio || '',
        alvoId: codigo,
        detalhes: { role, duracao: labelDuracao },
      });

      setTokenGerado(codigo);
      setShowModal(true);
      setUsadoMes(prev => prev + 1);
      // Notificar master_admins sobre o token gerado (fire-and-forget)
      if (!isMasterAdmin) {
        notificarMasterTokenGerado(codigo).catch(() => null);
      }
    } catch (e) {
      Alert.alert('Erro', 'Não foi possível gerar o token. Tente novamente.');
      logger.error('token', 'Erro gerar token', { erro: String(e) });
    } finally {
      setGerando(false);
    }
  };

  const copiar = async () => {
    if (!tokenGerado) return;
    await Clipboard.setStringAsync(tokenGerado);
    Alert.alert('Copiado!', 'Código copiado para a área de transferência.');
  };

  const compartilhar = async () => {
    if (!tokenGerado) return;
    const roleLabel = roles.find(r => r.key === role)?.label || role;
    await Share.share({
      message: `🔐 Convite de Acesso — TCS Relatório de Risco\n\nVocê foi convidado para integrar a equipe de vistoria técnica.\n\nCódigo de acesso: ${tokenGerado}\nPerfil: ${roleLabel}\nMunicípio: ${municipio}\nValidade: ${labelDuracao} (expira em ${formatarExpiracao(horasSelecionadas)})\n\nBaixe o app TCS - Relatório de Risco e use este código na tela de validação de token para criar sua conta.`,
    });
  };

  const solicitarAumento = async () => {
    if (solicitando || solicitacaoEnviada) return;
    setSolicitando(true);
    try {
      await notificarMasterSolicitaTokens();
      setSolicitacaoEnviada(true);
      Alert.alert('Solicitação enviada', 'O Master Admin foi notificado sobre sua solicitação de aumento de limite.');
    } catch {
      Alert.alert('Erro', 'Não foi possível enviar a solicitação. Tente novamente.');
    } finally {
      setSolicitando(false);
    }
  };

  const selectedRole = roles.find(r => r.key === role);

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={{ paddingTop: insets.top }}>
        <AppHeader
          title="Novo convite"
          subtitle="Defina acesso, território e validade"
          onBack={() => router.back()}
        />
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}>
              {/* Banner de quota — apenas para admin (não master) */}
              {!isMasterAdmin && (
                <View style={[styles.quotaBanner, {
                   backgroundColor: usadoMes >= limiteTotal
                     ? theme.errorLight
                     : usadoMes >= limiteTotal * 0.8
                       ? theme.warningLight
                       : theme.secondary,
                   borderColor: usadoMes >= limiteTotal
                     ? theme.error
                     : usadoMes >= limiteTotal * 0.8
                       ? theme.warning
                       : theme.border,
                }]}>
                  <View style={{ flex: 1 }}>
                    {/* Linha de título */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Feather
                        name={usadoMes >= limiteTotal ? 'alert-circle' : 'key'}
                        size={14}
                        color={usadoMes >= limiteTotal ? theme.error : usadoMes >= limiteTotal * 0.8 ? theme.warning : theme.primary}
                      />
                      <Text style={[styles.quotaTitle, {
                        color: usadoMes >= limiteTotal ? theme.error : usadoMes >= limiteTotal * 0.8 ? theme.warning : theme.text
                      }]}>
                        {usadoMes >= limiteTotal
                          ? 'Limite mensal atingido'
                          : `${usadoMes} de ${limiteTotal} tokens usados este mês`}
                      </Text>
                    </View>

                    {/* Barra de progresso */}
                    <View style={[styles.quotaProgressBg, { backgroundColor: `${theme.border}` }]}>
                      <View style={[styles.quotaProgressFill, {
                        width: `${Math.min((usadoMes / limiteTotal) * 100, 100)}%`,
                        backgroundColor: usadoMes >= limiteTotal ? theme.error : usadoMes >= limiteTotal * 0.8 ? theme.warning : theme.primary,
                      }]} />
                    </View>

                    {/* Mensagem + botão solicitar */}
                    {usadoMes >= limiteTotal * 0.8 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={[styles.quotaSub, {
                           color: usadoMes >= limiteTotal ? theme.error : theme.warning, flex: 1
                        }]}>
                          {usadoMes >= limiteTotal
                            ? 'Nenhum token disponível neste mês.'
                            : 'Você está perto do limite mensal.'}
                        </Text>
                        <TouchableOpacity
                          style={[styles.solicitarBtn, {
                            backgroundColor: solicitacaoEnviada
                              ? theme.successLight
                              : usadoMes >= limiteTotal
                                ? theme.errorLight
                                : theme.warningLight,
                            borderColor: solicitacaoEnviada ? theme.success : usadoMes >= limiteTotal ? theme.error : theme.warning,
                            opacity: solicitando ? 0.6 : 1,
                          }]}
                          onPress={solicitarAumento}
                          disabled={solicitando || solicitacaoEnviada}
                          activeOpacity={0.75}
                        >
                          <Feather
                            name={solicitacaoEnviada ? 'check' : 'send'}
                            size={11}
                            color={solicitacaoEnviada ? theme.success : usadoMes >= limiteTotal ? theme.error : theme.warning}
                          />
                          <Text style={[styles.solicitarBtnText, {
                            color: solicitacaoEnviada ? theme.success : usadoMes >= limiteTotal ? theme.error : theme.warning
                          }]}>
                            {solicitacaoEnviada ? 'Enviado' : 'Solicitar aumento'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              )}
        <View style={styles.sectionIntro}>
          <Text style={[styles.sectionNumber, { color: theme.primary }]}>01</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Perfil de acesso</Text>
            <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>Escolha o que esta pessoa poderá fazer no TCS.</Text>
          </View>
        </View>
        <View style={styles.roleGrid}>
        {roles.map(r => (
          <TouchableOpacity
            key={r.key}
            style={[
              styles.roleCard,
              { backgroundColor: role === r.key ? theme.secondary : theme.surface, borderColor: role === r.key ? theme.primary : theme.cardBorder },
              role === r.key && { borderWidth: 2 },
            ]}
            onPress={() => setRole(r.key)}
          >
            <View style={[styles.roleIcon, { backgroundColor: theme.iconBackground }]}>
              <Feather name={r.icon} size={22} color={role === r.key ? theme.primary : theme.textSecondary} />
            </View>
            <View style={styles.roleCopy}>
              <Text style={[styles.roleName, { color: theme.text }]}>{r.label}</Text>
              <Text style={[styles.roleDesc, { color: theme.textSecondary }]}>{r.desc}</Text>
            </View>
            {role === r.key && (
              <Feather name="check-circle" size={20} color={theme.primary} />
            )}
          </TouchableOpacity>
        ))}
        </View>

        <View style={styles.sectionIntro}>
          <Text style={[styles.sectionNumber, { color: theme.primary }]}>02</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Território obrigatório</Text>
            <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>O convite funcionará somente no município selecionado.</Text>
          </View>
        </View>
        {isMasterAdmin ? (
          loadingMunicipios ? (
            <ActivityIndicator color={theme.primary} style={{ marginBottom: 24 }} />
          ) : (
            <View style={{ marginBottom: 24 }}>
              {/* Campo de busca */}
              <View style={[styles.searchBox, { backgroundColor: theme.surfaceHighlight, borderColor: municipio ? theme.primary : theme.cardBorder }]}>
                <Feather name="search" size={16} color={theme.textSecondary} />
                <TextInput
                  style={[styles.searchInput, { color: theme.text }]}
                  placeholder={municipio || 'Pesquisar município...'}
                  placeholderTextColor={municipio ? theme.primary : theme.textSecondary}
                  value={municipioSearch}
                  onChangeText={setMunicipioSearch}
                  autoCorrect={false}
                />
                {municipioSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setMunicipioSearch('')}>
                    <Feather name="x" size={16} color={theme.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
              {/* Lista filtrada */}
              <View style={styles.municipioList}>
                {municipios
                  .filter(m => m.toLowerCase().includes(municipioSearch.toLowerCase()))
                  .map(m => (
                    <TouchableOpacity
                      key={m}
                      style={[
                        styles.municipioChip,
                        { borderColor: municipio === m ? theme.primary : theme.cardBorder,
                          backgroundColor: municipio === m ? theme.secondary : theme.surface },
                      ]}
                      onPress={() => { setMunicipio(m); setMunicipioSearch(''); }}
                    >
                      {municipio === m && <Feather name="check" size={12} color={theme.primary} />}
                      <Text style={[styles.municipioText, { color: municipio === m ? theme.primary : theme.textSecondary }]}>
                        {m}
                      </Text>
                    </TouchableOpacity>
                  ))}
              </View>
              {!municipio && (
                <StateBanner title="Selecione um município" description="Este campo é obrigatório para gerar o convite." variant="warning" />
              )}
            </View>
          )
        ) : (
          <View style={[styles.municipioLocked, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <Feather name="map-pin" size={16} color={theme.textSecondary} />
            <Text style={[styles.municipioLockedText, { color: theme.text }]}>{municipio || 'Nenhum município definido'}</Text>
          </View>
        )}

        <View style={styles.sectionIntro}>
          <Text style={[styles.sectionNumber, { color: theme.primary }]}>03</Text>
          <View style={{ flex: 1 }}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Validade do convite</Text>
            <Text style={[styles.sectionDescription, { color: theme.textSecondary }]}>Escolha por quanto tempo o código ficará disponível.</Text>
          </View>
        </View>
        <View style={styles.duracaoRow}>
          {DURACOES.map(d => (
            <TouchableOpacity
              key={d.key}
              style={[
                styles.duracaoChip,
                { borderColor: duracao === d.key ? theme.primary : theme.cardBorder,
                  backgroundColor: duracao === d.key ? theme.secondary : theme.surface },
              ]}
              onPress={() => setDuracao(d.key)}
            >
              <Text style={[styles.duracaoText, { color: duracao === d.key ? theme.primary : theme.textSecondary }]}>
                {d.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Campos de data/hora para duração personalizada */}
        {duracao === 'custom' && (
          <View style={{ marginBottom: 24 }}>
            <View style={styles.customRow}>
              <FormField
                  label="Data"
                  required
                  containerStyle={{ flex: 1.4 }}
                  error={customErro ?? undefined}
                  value={customData}
                  onChangeText={t => {
                    // Formata automaticamente dd/mm/aaaa
                    const digits = t.replace(/\D/g, '').substring(0, 8);
                    let formatted = digits;
                    if (digits.length > 2) formatted = digits.slice(0,2) + '/' + digits.slice(2);
                    if (digits.length > 4) formatted = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4);
                    setCustomData(formatted);
                    setCustomErro(null);
                  }}
                  keyboardType="numeric"
                  placeholder="dd/mm/aaaa"
                  maxLength={10}
                />
              <FormField
                  label="Hora"
                  required
                  containerStyle={{ flex: 1 }}
                  error={customErro ?? undefined}
                  value={customHora}
                  onChangeText={t => {
                    const digits = t.replace(/\D/g, '').substring(0, 4);
                    let formatted = digits;
                    if (digits.length > 2) formatted = digits.slice(0,2) + ':' + digits.slice(2);
                    setCustomHora(formatted);
                    setCustomErro(null);
                  }}
                  keyboardType="numeric"
                  placeholder="hh:mm"
                  maxLength={5}
                />
            </View>
          </View>
        )}

        <StateBanner
          title="Revise antes de gerar"
          description={`${selectedRole?.label} · ${municipio || 'Município pendente'} · ${labelDuracao}\nExpira em ${formatarExpiracao(horasSelecionadas)} e só pode ser usado uma vez.`}
          variant={municipio ? 'info' : 'warning'}
        />

        <Button
          label={gerando ? 'Gerando...' : 'Gerar convite de acesso'}
          variant="primary"
          size="lg"
          onPress={gerarToken}
          loading={gerando}
          disabled={gerando || !municipio}
          iconLeft={!gerando ? <Feather name="key" size={20} color="#FFF" /> : undefined}
          style={{ marginTop: 4 }}
        />
      </ScrollView>

      {/* Modal: Token gerado */}
      <Modal visible={showModal} animationType="fade" transparent>
        <View style={[styles.modalOverlay, { backgroundColor: theme.overlay }]}>
          <View style={[styles.modalCard, { backgroundColor: theme.surface }]}>
            <View style={[styles.modalIcon, { backgroundColor: theme.successLight }]}>
              <Feather name="check-circle" size={40} color={theme.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Convite pronto</Text>
            <Text style={[styles.modalDesc, { color: theme.textSecondary }]}>
              Compartilhe este código com o novo usuário.
            </Text>
            <TouchableOpacity
              style={[styles.tokenDisplay, { backgroundColor: theme.background, borderColor: theme.border }]}
              onPress={copiar}
            >
              <Text style={[styles.tokenCode, { color: theme.text }]}>{tokenGerado}</Text>
              <Feather name="copy" size={18} color={theme.primary} />
            </TouchableOpacity>
            <Text style={[styles.tokenInfo, { color: theme.textSecondary }]}>
              {selectedRole?.label} · {municipio} · Válido por {labelDuracao}
            </Text>
            <Text style={[styles.tokenExpira, { color: theme.textSecondary }]}>
              Expira em: {formatarExpiracao(horasSelecionadas)}
            </Text>
            <View style={styles.modalActions}>
              <Button
                label="Compartilhar"
                onPress={compartilhar}
                variant="primary"
                iconLeft={<Feather name="share-2" size={18} color="#FFF" />}
                style={{ marginBottom: 12 }}
              />
              <Button
                label="Fechar"
                onPress={() => { setShowModal(false); router.back(); }}
                variant="ghost"
              />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 20, paddingBottom: 60, gap: 18 },
  sectionIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginTop: 8 },
  sectionNumber: { fontSize: 13, fontWeight: '900', letterSpacing: 1 },
  sectionTitle: { fontSize: 18, fontWeight: '800' },
  sectionDescription: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  roleGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  roleCard: {
    width: '48%', minHeight: 150, borderRadius: 18,
    borderWidth: 1, padding: 14, gap: 10,
  },
  roleIcon: {
    width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  roleCopy: { flex: 1 },
  roleName: { fontSize: 15, fontWeight: '700', marginBottom: 3 },
  roleDesc: { fontSize: 12, lineHeight: 16 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center', alignItems: 'center', padding: 24,
  },
  modalCard: {
    borderRadius: 24, padding: 32, alignItems: 'center', width: '100%',
  },
  modalIcon: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: 'center', alignItems: 'center', marginBottom: 20,
  },
  modalTitle: { fontSize: 24, fontWeight: '800', marginBottom: 8 },
  modalDesc: { fontSize: 14, textAlign: 'center', marginBottom: 24, lineHeight: 20 },
  tokenDisplay: {
    flexDirection: 'row', alignItems: 'center', gap: 16,
    borderRadius: 16, borderWidth: 1, paddingHorizontal: 24, paddingVertical: 20,
    marginBottom: 12, width: '100%', justifyContent: 'center',
  },
  tokenCode: { fontSize: 22, fontWeight: '900', letterSpacing: 3, fontVariant: ['tabular-nums'] },
  tokenInfo: { fontSize: 12, marginBottom: 4, textAlign: 'center' },
  tokenExpira: { fontSize: 12, marginBottom: 28, textAlign: 'center' },
  duracaoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  duracaoChip: {
    minWidth: '30%', flexGrow: 1, height: 48, borderRadius: 12, borderWidth: 1.5,
    justifyContent: 'center', alignItems: 'center',
  },
  duracaoText: { fontSize: 14, fontWeight: '700' },
  modalActions: { width: '100%' },
  searchBox: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1.5, paddingHorizontal: 14, height: 48, marginBottom: 12,
  },
  searchInput: { flex: 1, fontSize: 15, fontWeight: '500' },
  municipioList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  municipioChip: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 12, borderWidth: 1.5,
    paddingHorizontal: 14, paddingVertical: 8, justifyContent: 'center',
  },
  municipioText: { fontSize: 13, fontWeight: '600' },
  municipioLocked: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    borderRadius: 12, borderWidth: 1, padding: 14, marginBottom: 24,
  },
  municipioLockedText: { fontSize: 15, fontWeight: '600' },
  quotaBanner: {
    borderWidth: 1, borderRadius: 14, padding: 14, marginBottom: 8,
  },
  quotaTitle: { fontSize: 13, fontWeight: '700' },
  quotaSub: { fontSize: 11, fontWeight: '500', lineHeight: 15 },
  quotaProgressBg: { height: 5, borderRadius: 3, overflow: 'hidden' },
  quotaProgressFill: { height: 5, borderRadius: 3 },
  solicitarBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 10,
  },
  solicitarBtnText: { fontSize: 11, fontWeight: '700' },
  customRow: { flexDirection: 'row', gap: 12 },
});
