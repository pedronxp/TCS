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
import { Button } from '../../../components/ui/Button';
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

function gerarCodigo(): string {
  // 12 chars criptograficamente seguros em formato XXXX-XXXX-XXXX
  // Entropia: 32^12 ≈ 1.2 × 10^18 combinações (vs 32^8 antes)
  // Sem ambiguidades: sem 0/O, 1/I/L
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const buffer = typeof crypto !== 'undefined' && crypto.getRandomValues
    ? crypto.getRandomValues(new Uint8Array(12))
    : new Uint8Array(12).map(() => Math.floor(Math.random() * 256));
  const raw = Array.from(buffer, b => chars[b % chars.length]).join('');
  return `${raw.slice(0, 4)}-${raw.slice(4, 8)}-${raw.slice(8, 12)}`;
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
      supabase.from('users').select('token_limit').eq('uid', profile.uid).single(),
      supabase.from('invite_tokens').select('*', { count: 'exact', head: true })
        .eq('criadoPor', profile.uid)
        .gte('criadoEm', inicioMes.toISOString()),
    ]).then(([limiteRes, countRes]) => {
      if (limiteRes.data?.token_limit) setLimiteTotal(limiteRes.data.token_limit);
      if (typeof countRes.count === 'number') setUsadoMes(countRes.count);
    }).catch(() => {});
  }, [profile?.uid, isMasterAdmin]);

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
      // Rate-limit: máx 10 tokens por hora por admin
      const umaHoraAtras = new Date(Date.now() - 3600000).toISOString();
      const { count } = await supabase
        .from('invite_tokens')
        .select('*', { count: 'exact', head: true })
        .eq('criadoPor', profile?.uid)
        .gte('criadoEm', umaHoraAtras);
      if ((count ?? 0) >= 10) {
        Alert.alert('Limite atingido', 'Você pode gerar no máximo 10 tokens por hora. Tente novamente mais tarde.');
        return;
      }

      const codigo = gerarCodigo();
      const expira = new Date(Date.now() + horasSelecionadas * 3600000).toISOString();

      const { error } = await supabase.from('invite_tokens').insert({
        codigo: codigo,
        role,
        municipio: municipio || profile?.municipio,
        usado: false,
        expiraEm: expira,
        criadoPor: profile?.uid,
        criadoPorNome: profile?.name ?? null,
      });

      if (error) throw error;

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
        notificarMasterTokenGerado(
          profile?.name ?? 'Usuário',
          municipio || profile?.municipio || '',
          role,
        ).catch(() => null);
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
      await notificarMasterSolicitaTokens(
        profile?.name ?? 'Administrador',
        municipio || profile?.municipio || '',
        usadoMes,
        limiteTotal,
      );
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
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" color={theme.textSecondary} size={24} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: theme.text }]}>Gerar Token</Text>
          <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Convite de acesso ao sistema</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}>
              {/* Banner de quota — apenas para admin (não master) */}
              {!isMasterAdmin && (
                <View style={[styles.quotaBanner, {
                  backgroundColor: usadoMes >= limiteTotal
                    ? 'rgba(239,68,68,0.08)'
                    : usadoMes >= limiteTotal * 0.8
                      ? 'rgba(245,158,11,0.08)'
                      : `${theme.primary}0D`,
                  borderColor: usadoMes >= limiteTotal
                    ? 'rgba(239,68,68,0.35)'
                    : usadoMes >= limiteTotal * 0.8
                      ? 'rgba(245,158,11,0.35)'
                      : `${theme.primary}35`,
                }]}>
                  <View style={{ flex: 1 }}>
                    {/* Linha de título */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <Feather
                        name={usadoMes >= limiteTotal ? 'alert-circle' : 'key'}
                        size={14}
                        color={usadoMes >= limiteTotal ? '#EF4444' : usadoMes >= limiteTotal * 0.8 ? '#F59E0B' : theme.primary}
                      />
                      <Text style={[styles.quotaTitle, {
                        color: usadoMes >= limiteTotal ? '#EF4444' : usadoMes >= limiteTotal * 0.8 ? '#F59E0B' : theme.text
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
                        backgroundColor: usadoMes >= limiteTotal ? '#EF4444' : usadoMes >= limiteTotal * 0.8 ? '#F59E0B' : theme.primary,
                      }]} />
                    </View>

                    {/* Mensagem + botão solicitar */}
                    {usadoMes >= limiteTotal * 0.8 && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
                        <Text style={[styles.quotaSub, {
                          color: usadoMes >= limiteTotal ? '#EF4444' : '#F59E0B', flex: 1
                        }]}>
                          {usadoMes >= limiteTotal
                            ? 'Nenhum token disponível neste mês.'
                            : 'Você está perto do limite mensal.'}
                        </Text>
                        <TouchableOpacity
                          style={[styles.solicitarBtn, {
                            backgroundColor: solicitacaoEnviada
                              ? 'rgba(16,185,129,0.15)'
                              : usadoMes >= limiteTotal
                                ? 'rgba(239,68,68,0.12)'
                                : 'rgba(245,158,11,0.12)',
                            borderColor: solicitacaoEnviada ? 'rgba(16,185,129,0.4)' : usadoMes >= limiteTotal ? 'rgba(239,68,68,0.4)' : 'rgba(245,158,11,0.4)',
                            opacity: solicitando ? 0.6 : 1,
                          }]}
                          onPress={solicitarAumento}
                          disabled={solicitando || solicitacaoEnviada}
                          activeOpacity={0.75}
                        >
                          <Feather
                            name={solicitacaoEnviada ? 'check' : 'send'}
                            size={11}
                            color={solicitacaoEnviada ? '#10B981' : usadoMes >= limiteTotal ? '#EF4444' : '#F59E0B'}
                          />
                          <Text style={[styles.solicitarBtnText, {
                            color: solicitacaoEnviada ? '#10B981' : usadoMes >= limiteTotal ? '#EF4444' : '#F59E0B'
                          }]}>
                            {solicitacaoEnviada ? 'Enviado' : 'Solicitar aumento'}
                          </Text>
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                </View>
              )}
        {/* Seleção de role */}
        <Text style={[styles.label, { color: theme.textSecondary }]}>PERFIL DE ACESSO</Text>
        {roles.map(r => (
          <TouchableOpacity
            key={r.key}
            style={[
              styles.roleCard,
              { backgroundColor: theme.surfaceHighlight, borderColor: role === r.key ? theme.primary : theme.cardBorder },
              role === r.key && { borderWidth: 2 },
            ]}
            onPress={() => setRole(r.key)}
          >
            <View style={[styles.roleIcon, {
              backgroundColor: role === r.key ? `${theme.primary}20` : theme.iconBackground
            }]}>
              <Feather name={r.icon} size={22} color={role === r.key ? theme.primary : theme.textSecondary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.roleName, { color: theme.text }]}>{r.label}</Text>
              <Text style={[styles.roleDesc, { color: theme.textSecondary }]}>{r.desc}</Text>
            </View>
            {role === r.key && (
              <Feather name="check-circle" size={20} color={theme.primary} />
            )}
          </TouchableOpacity>
        ))}

        {/* Seleção de município */}
        <Text style={[styles.label, { color: theme.textSecondary, marginTop: 8 }]}>
          MUNICÍPIO <Text style={{ color: '#EF4444' }}>*</Text>
        </Text>
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
                          backgroundColor: municipio === m ? `${theme.primary}15` : theme.surfaceHighlight },
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
                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 6 }}>
                  Selecione um município para continuar.
                </Text>
              )}
            </View>
          )
        ) : (
          <View style={[styles.municipioLocked, { backgroundColor: theme.surfaceHighlight, borderColor: theme.cardBorder }]}>
            <Feather name="map-pin" size={16} color={theme.textSecondary} />
            <Text style={[styles.municipioLockedText, { color: theme.text }]}>{municipio || 'Nenhum município definido'}</Text>
          </View>
        )}

        {/* Seleção de prazo */}
        <Text style={[styles.label, { color: theme.textSecondary, marginTop: 8 }]}>VALIDADE DO TOKEN</Text>
        <View style={styles.duracaoRow}>
          {DURACOES.map(d => (
            <TouchableOpacity
              key={d.key}
              style={[
                styles.duracaoChip,
                { borderColor: duracao === d.key ? theme.primary : theme.cardBorder,
                  backgroundColor: duracao === d.key ? `${theme.primary}15` : theme.surfaceHighlight },
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
              <View style={{ flex: 1.4 }}>
                <Text style={[styles.customLabel, { color: theme.textSecondary }]}>DATA (dd/mm/aaaa)</Text>
                <TextInput
                  style={[styles.customInput, { backgroundColor: theme.surfaceHighlight, borderColor: customErro ? '#EF4444' : theme.border, color: theme.text }]}
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
                  placeholderTextColor={theme.textSecondary}
                  maxLength={10}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.customLabel, { color: theme.textSecondary }]}>HORA (hh:mm)</Text>
                <TextInput
                  style={[styles.customInput, { backgroundColor: theme.surfaceHighlight, borderColor: customErro ? '#EF4444' : theme.border, color: theme.text }]}
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
                  placeholderTextColor={theme.textSecondary}
                  maxLength={5}
                />
              </View>
            </View>
            {customErro && (
              <View style={styles.customErroBox}>
                <Feather name="alert-circle" size={14} color="#EF4444" />
                <Text style={styles.customErroText}>{customErro}</Text>
              </View>
            )}
          </View>
        )}

        {/* Info do token */}
        <View style={[styles.infoCard, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}>
          <Feather name="info" size={16} color={theme.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.infoTitle, { color: theme.text }]}>Sobre este token</Text>
            <Text style={[styles.infoText, { color: theme.textSecondary }]}>
              {`• Válido por ${labelDuracao}\n• Expira em: ${formatarExpiracao(horasSelecionadas)}\n• Uso único — expira após o primeiro cadastro\n• Perfil: ${selectedRole?.label}\n• Município: ${municipio}`}
            </Text>
          </View>
        </View>

        <Button
          label={gerando ? 'Gerando...' : 'Gerar Token de Acesso'}
          variant="primary"
          size="lg"
          onPress={gerarToken}
          loading={gerando}
          disabled={gerando}
          iconLeft={!gerando ? <Feather name="key" size={20} color="#FFF" /> : undefined}
          style={{ marginTop: 4 }}
        />
      </ScrollView>

      {/* Modal: Token gerado */}
      <Modal visible={showModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.surfaceHighlight }]}>
            <View style={[styles.modalIcon, { backgroundColor: `${theme.primary}15` }]}>
              <Feather name="check-circle" size={40} color={theme.primary} />
            </View>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Token Gerado!</Text>
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
  header: {
    paddingBottom: 20, paddingHorizontal: 24,
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
    textTransform: 'uppercase', marginBottom: 12,
  },
  roleCard: {
    flexDirection: 'row', alignItems: 'center', borderRadius: 16,
    borderWidth: 1, padding: 16, marginBottom: 12, gap: 14,
  },
  roleIcon: {
    width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center',
  },
  roleName: { fontSize: 16, fontWeight: '700', marginBottom: 2 },
  roleDesc: { fontSize: 13 },
  infoCard: {
    flexDirection: 'row', borderRadius: 14, borderWidth: 1, padding: 16, marginTop: 8, marginBottom: 32,
  },
  infoTitle: { fontSize: 14, fontWeight: '700', marginBottom: 6 },
  infoText: { fontSize: 13, lineHeight: 20 },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
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
  duracaoRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  duracaoChip: {
    flex: 1, height: 44, borderRadius: 12, borderWidth: 1.5,
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
  customLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, marginBottom: 6 },
  customInput: {
    height: 52, borderRadius: 14, borderWidth: 1.5,
    paddingHorizontal: 14, fontSize: 16, fontWeight: '600',
  },
  customErroBox: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)', borderRadius: 10,
    padding: 10, marginTop: 8,
  },
  customErroText: { color: '#EF4444', fontSize: 13, flex: 1 },
});
