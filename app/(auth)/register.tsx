import React, { useRef, useState } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView,
  Animated,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { supabase } from '../../utils/supabase';
import { traduzirErroAuth } from '../../utils/authErrors';
import { Feather } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { Card, Button } from '../../components/ui';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const formatarToken = (t: string) => {
  const l = t.replace(/[^A-Z0-9]/g, '').toUpperCase();
  return (l.match(/.{1,4}/g) || []).join('-').substring(0, 14);
};

const formatarTelefone = (t: string) => {
  const d = t.replace(/\D/g, '').substring(0, 11);
  if (d.length <= 2) return d;
  if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
};

const calcularForca = (s: string): 0 | 1 | 2 => {
  if (s.length < 8) return 0;
  return s.length >= 10 && /[^A-Za-z0-9]/.test(s) ? 2 : 1;
};

// ─── Texto LGPD ───────────────────────────────────────────────────────────────
const LGPD_SECTIONS = [
  {
    titulo: '1. Identificação do Controlador',
    texto: 'O sistema TCS — Relatório e Risco é operado pela Defesa Civil Municipal, responsável pelo tratamento dos dados pessoais coletados neste aplicativo, nos termos da Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD).',
  },
  {
    titulo: '2. Dados Coletados',
    texto: 'Para o funcionamento do sistema, coletamos:\n\n• Identificação: nome completo, e-mail e número de telefone/WhatsApp\n• Localização: coordenadas GPS das edificações vistoriadas (não rastreamos sua localização de forma contínua)\n• Imagens: fotografias de edificações capturadas durante vistorias técnicas\n• Dados funcionais: registros de vistorias, laudos técnicos, logs de acesso e atividades no sistema',
  },
  {
    titulo: '3. Finalidade do Tratamento',
    texto: 'Os dados são utilizados exclusivamente para:\n\n• Execução de vistorias técnicas e elaboração de laudos da Defesa Civil\n• Autenticação segura e controle de acesso ao sistema\n• Comunicação via WhatsApp para login e notificações operacionais\n• Auditoria de ações e rastreabilidade das atividades no sistema\n• Cumprimento de obrigações legais da Defesa Civil',
  },
  {
    titulo: '4. Base Legal (LGPD)',
    texto: 'O tratamento é fundamentado no art. 7º da LGPD, incisos:\n\n• II — Cumprimento de obrigação legal ou regulatória pelo controlador\n• III — Execução de políticas públicas previstas em leis ou regulamentos\n• V — Execução de contrato do qual o titular seja parte',
  },
  {
    titulo: '5. Compartilhamento de Dados',
    texto: 'Seus dados não são vendidos ou compartilhados com terceiros para fins comerciais. Podem ser compartilhados com:\n\n• Autoridades públicas quando exigido por determinação legal\n• Administradores municipais do sistema para fins de supervisão operacional',
  },
  {
    titulo: '6. Retenção dos Dados',
    texto: 'Os dados são mantidos pelo período necessário ao cumprimento das finalidades descritas e conforme exigências legais aplicáveis à Defesa Civil, podendo se estender por até 5 (cinco) anos após o encerramento do vínculo funcional do usuário.',
  },
  {
    titulo: '7. Segurança',
    texto: 'Adotamos medidas técnicas e organizacionais de segurança, incluindo:\n\n• Autenticação com senha e controle de tentativas (rate limiting)\n• Criptografia em trânsito (TLS/HTTPS)\n• Controle de acesso por perfil (RBAC)\n• Logs de auditoria completos de todas as ações',
  },
  {
    titulo: '8. Seus Direitos (Art. 18 LGPD)',
    texto: 'Nos termos da LGPD, você tem direito a:\n\n• Confirmação da existência de tratamento e acesso aos seus dados\n• Correção de dados incompletos, inexatos ou desatualizados\n• Anonimização, bloqueio ou eliminação de dados desnecessários\n• Portabilidade dos dados a outro fornecedor de serviço\n• Revogação do consentimento, a qualquer momento\n• Informação sobre as entidades com as quais os dados foram compartilhados',
  },
  {
    titulo: '9. Permissões do Aplicativo',
    texto: 'Para funcionamento completo, o aplicativo solicita acesso a:\n\n• Câmera: captura de fotografias de evidências nas vistorias técnicas\n• Localização: georreferenciamento das edificações inspecionadas\n• Notificações: recebimento de alertas operacionais e agendamentos',
  },
  {
    titulo: '10. Contato e Exercício de Direitos',
    texto: 'Para exercer seus direitos, solicitar esclarecimentos ou reportar incidentes relacionados ao tratamento de seus dados pessoais, entre em contato com o Encarregado de Proteção de Dados (DPO) do seu município através do administrador do sistema.\n\nAo prosseguir com o cadastro, você declara ter lido, compreendido e concordado integralmente com esta Política de Privacidade e os Termos de Uso do sistema TCS.',
  },
];

// ─── Tipo de etapa ────────────────────────────────────────────────────────────
type Etapa = 'form' | 'termos' | 'permissoes' | 'sucesso';

// ─── Permissão helper ─────────────────────────────────────────────────────────
type PermStatus = 'pendente' | 'concedida' | 'negada';

// ─────────────────────────────────────────────────────────────────────────────
export default function RegisterScreen() {
  const { theme } = useTheme();

  // Etapa atual
  const [etapa, setEtapa] = useState<Etapa>('form');

  // Dados do formulário
  const [token, setToken]                   = useState('');
  const [nome, setNome]                     = useState('');
  const [email, setEmail]                   = useState('');
  const [telefone, setTelefone]             = useState('');
  const [senha, setSenha]                   = useState('');
  const [confirmarSenha, setConfirmarSenha] = useState('');
  const [senhaForca, setSenhaForca]         = useState<0 | 1 | 2>(0);
  const [showPassword, setShowPassword]     = useState(false);
  const [showConfirm, setShowConfirm]       = useState(false);

  // Dados validados do token (guardados para o submit final)
  const tokenDataRef = useRef<any>(null);
  const codigoNormRef = useRef('');

  // Estado de loading/erro
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  // Termos
  const [termosScrollado, setTermosScrollado] = useState(false);
  const [termosAceitos, setTermosAceitos]     = useState(false);

  // Permissões
  const [permCamera, setPermCamera]           = useState<PermStatus>('pendente');
  const [permLocalizacao, setPermLocalizacao] = useState<PermStatus>('pendente');
  const [permNotificacoes, setPermNotificacoes] = useState<PermStatus>('pendente');

  // ── Etapa 1: validar formulário e token ─────────────────────────────────
  const handleValidarFormulario = async () => {
    if (!token || !nome || !email || !senha || !confirmarSenha) {
      setError('Preencha todos os campos obrigatórios.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
    if (!emailRegex.test(email.trim())) {
      setError('Informe um endereço de e-mail válido.');
      return;
    }
    if (senha.length < 8) {
      setError('A senha deve ter no mínimo 8 caracteres.');
      return;
    }
    if (!/[a-zA-Z]/.test(senha) || !/[0-9]/.test(senha)) {
      setError('A senha deve conter letras e números.');
      return;
    }
    if (senha !== confirmarSenha) {
      setError('As senhas não coincidem. Verifique e tente novamente.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const codigoNorm = token.trim().toUpperCase().replace(/\s/g, '');
      const { data: tokenValidation, error: valError } = await supabase
        .rpc('validate_invite_token', { p_codigo: codigoNorm })
        .single();

      if (valError || !tokenValidation) throw new Error('Token inválido ou já utilizado.');
      if (!tokenValidation.valido) throw new Error(tokenValidation.motivo);

      if (tokenValidation.municipio) {
        const { data: dominioOk } = await supabase.rpc('check_email_domain', {
          p_municipio: tokenValidation.municipio,
          p_email: email.trim().toLowerCase(),
        });
        if (dominioOk === false) {
          throw new Error('Este e-mail não é autorizado para o município informado.');
        }
      }

      tokenDataRef.current = tokenValidation;
      codigoNormRef.current = codigoNorm;
      setEtapa('termos');
    } catch (e: any) {
      setError(traduzirErroAuth(e.message) || 'Erro ao validar token.');
    } finally {
      setLoading(false);
    }
  };

  // ── Etapa 2: aceitar termos ──────────────────────────────────────────────
  const handleAceitarTermos = () => {
    setEtapa('permissoes');
  };

  // ── Etapa 3: solicitar permissões ────────────────────────────────────────
  const solicitarCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    setPermCamera(status === 'granted' ? 'concedida' : 'negada');
  };

  const solicitarLocalizacao = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setPermLocalizacao(status === 'granted' ? 'concedida' : 'negada');
  };

  const solicitarNotificacoes = async () => {
    const { status } = await Notifications.requestPermissionsAsync();
    setPermNotificacoes(status === 'granted' ? 'concedida' : 'negada');
  };

  const solicitarTodas = async () => {
    await Promise.all([solicitarCamera(), solicitarLocalizacao(), solicitarNotificacoes()]);
  };

  // ── Etapa 4: registrar ───────────────────────────────────────────────────
  const handleRegistrar = async () => {
    setLoading(true);
    setError(null);
    try {
      const tokenData = tokenDataRef.current;
      const codigoNorm = codigoNormRef.current;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password: senha,
        options: { data: { name: nome, role: tokenData.role, municipio: tokenData.municipio } },
      });
      if (authError) throw authError;

      const uid = authData.user?.id;
      if (!uid) throw new Error('Falha ao criar conta. Tente novamente.');

      const { error: insertError } = await supabase.from('users').insert({
        uid,
        name: nome,
        username: email.split('@')[0],
        email: email.trim().toLowerCase(),
        phone: telefone ? `+55${telefone.replace(/\D/g, '')}` : null,
        role: tokenData.role,
        municipio: tokenData.municipio,
        isApproved: true,
        createdAt: new Date().toISOString(),
      });
      if (insertError) throw insertError;

      let deviceIp = '';
      try {
        const ipRes = await fetch('https://api.ipify.org?format=json');
        deviceIp = (await ipRes.json()).ip || '';
      } catch { /* silencioso */ }

      await supabase.rpc('mark_token_used', {
        p_codigo: codigoNorm,
        p_uid: uid,
        p_nome: nome,
        p_ip: deviceIp,
      });

      try {
        if (tokenData.criadoPor) {
          const { data: adminData } = await supabase.rpc('get_push_token_by_uid', { p_uid: tokenData.criadoPor });
          if (adminData) {
            const { notificarNovoUsuarioCadastrado } = await import('../../services/NotificationService');
            await notificarNovoUsuarioCadastrado(adminData, nome, tokenData.municipio || '');
          }
        }
      } catch { /* silencioso */ }

      await supabase.auth.signOut();
      setEtapa('sucesso');
    } catch (e: any) {
      setError(traduzirErroAuth(e.message) || 'Erro ao registrar.');
    } finally {
      setLoading(false);
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Sucesso
  // ─────────────────────────────────────────────────────────────────────────
  if (etapa === 'sucesso') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.sucessoContainer}>
          <Card>
            <View style={{ alignItems: 'center', paddingVertical: 8 }}>
              <Feather name="check-circle" size={56} color="#10B981" />
              <Text style={{ fontSize: 20, fontWeight: '700', marginTop: 16, color: theme.text }}>
                Conta criada com sucesso!
              </Text>
              <Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
                Sua identidade foi verificada. Você já pode fazer login com suas credenciais.
              </Text>
              <Button variant="primary" onPress={() => router.replace('/(auth)/login')} style={{ marginTop: 24 }}>
                Ir para o Login
              </Button>
            </View>
          </Card>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Permissões
  // ─────────────────────────────────────────────────────────────────────────
  if (etapa === 'permissoes') {
    const perms = [
      {
        icon: 'camera' as const,
        color: '#8B5CF6',
        titulo: 'Câmera',
        desc: 'Fotografar evidências e edificações durante vistorias.',
        status: permCamera,
        solicitar: solicitarCamera,
      },
      {
        icon: 'map-pin' as const,
        color: '#3B82F6',
        titulo: 'Localização',
        desc: 'Georreferenciar as edificações inspecionadas no mapa.',
        status: permLocalizacao,
        solicitar: solicitarLocalizacao,
      },
      {
        icon: 'bell' as const,
        color: '#F59E0B',
        titulo: 'Notificações',
        desc: 'Receber alertas operacionais e agendamentos de vistorias.',
        status: permNotificacoes,
        solicitar: solicitarNotificacoes,
      },
    ];

    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
              onPress={() => setEtapa('termos')}
            >
              <Feather name="arrow-left" color={theme.textSecondary} size={24} />
            </TouchableOpacity>
            <StepIndicator etapa={3} theme={theme} />
          </View>

          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: theme.text }]}>Permissões</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              O app precisa de acesso a alguns recursos do seu dispositivo para funcionar corretamente.
            </Text>
          </View>

          <View style={{ gap: 12, marginBottom: 24 }}>
            {perms.map(p => (
              <View
                key={p.titulo}
                style={[styles.permCard, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}
              >
                <View style={[styles.permIcon, { backgroundColor: `${p.color}18` }]}>
                  <Feather name={p.icon} size={22} color={p.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.permTitulo, { color: theme.text }]}>{p.titulo}</Text>
                  <Text style={[styles.permDesc, { color: theme.textSecondary }]}>{p.desc}</Text>
                </View>
                {p.status === 'pendente' ? (
                  <TouchableOpacity
                    style={[styles.permBtn, { backgroundColor: theme.primary }]}
                    onPress={p.solicitar}
                  >
                    <Text style={styles.permBtnText}>Permitir</Text>
                  </TouchableOpacity>
                ) : (
                  <View style={[styles.permStatus, { backgroundColor: p.status === 'concedida' ? '#10B98115' : '#EF444415' }]}>
                    <Feather
                      name={p.status === 'concedida' ? 'check' : 'x'}
                      size={14}
                      color={p.status === 'concedida' ? '#10B981' : '#EF4444'}
                    />
                  </View>
                )}
              </View>
            ))}
          </View>

          {(permCamera === 'pendente' || permLocalizacao === 'pendente' || permNotificacoes === 'pendente') && (
            <TouchableOpacity
              style={[styles.solicitarTodasBtn, { borderColor: theme.primary }]}
              onPress={solicitarTodas}
            >
              <Feather name="zap" size={15} color={theme.primary} />
              <Text style={[styles.solicitarTodasText, { color: theme.primary }]}>Permitir Tudo de Uma Vez</Text>
            </TouchableOpacity>
          )}

          <View style={[styles.infoBox, { backgroundColor: `${theme.primary}10`, borderColor: `${theme.primary}25`, marginBottom: 24 }]}>
            <Feather name="info" size={14} color={theme.primary} />
            <Text style={[styles.infoText, { color: theme.primary }]}>
              Permissões negadas podem ser alteradas nas Configurações do sistema a qualquer momento.
            </Text>
          </View>

          {error && <ErrorBox msg={error} />}

          <Button variant="primary" loading={loading} onPress={handleRegistrar} disabled={loading}>
            Criar Minha Conta
          </Button>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Termos LGPD
  // ─────────────────────────────────────────────────────────────────────────
  if (etapa === 'termos') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={[styles.termosHeader, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
            onPress={() => setEtapa('form')}
          >
            <Feather name="arrow-left" color={theme.textSecondary} size={24} />
          </TouchableOpacity>
          <View style={{ flex: 1, marginLeft: 14 }}>
            <Text style={[styles.termosHeaderTitulo, { color: theme.text }]}>Política de Privacidade</Text>
            <Text style={[styles.termosHeaderSub, { color: theme.textSecondary }]}>LGPD · Lei nº 13.709/2018</Text>
          </View>
          <StepIndicator etapa={2} theme={theme} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.termosScroll}
          onScroll={({ nativeEvent }) => {
            const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
            const chegouFim = contentOffset.y + layoutMeasurement.height >= contentSize.height - 40;
            if (chegouFim) setTermosScrollado(true);
          }}
          scrollEventThrottle={16}
        >
          {LGPD_SECTIONS.map((s, i) => (
            <View key={i} style={styles.termosSection}>
              <Text style={[styles.termosTitulo, { color: theme.text }]}>{s.titulo}</Text>
              <Text style={[styles.termosTexto, { color: theme.textSecondary }]}>{s.texto}</Text>
            </View>
          ))}
          <View style={[styles.termosFim, { borderTopColor: theme.border }]}>
            <Feather name="check-circle" size={16} color="#10B981" />
            <Text style={[styles.termosFimText, { color: theme.textSecondary }]}>
              Fim do documento · Versão 1.0 · Abril/2026
            </Text>
          </View>
        </ScrollView>

        <View style={[styles.termosFooter, { backgroundColor: theme.surfaceHighlight, borderTopColor: theme.border }]}>
          {!termosScrollado && (
            <Text style={[styles.termosAviso, { color: theme.textSecondary }]}>
              Role até o final para aceitar
            </Text>
          )}
          <TouchableOpacity
            style={styles.checkRow}
            onPress={() => termosScrollado && setTermosAceitos(v => !v)}
            activeOpacity={termosScrollado ? 0.7 : 1}
          >
            <View style={[
              styles.checkbox,
              {
                borderColor: termosScrollado ? theme.primary : theme.border,
                backgroundColor: termosAceitos ? theme.primary : 'transparent',
              },
            ]}>
              {termosAceitos && <Feather name="check" size={13} color="#FFF" />}
            </View>
            <Text style={[styles.checkLabel, { color: termosScrollado ? theme.text : theme.textSecondary }]}>
              Li e concordo com a Política de Privacidade e os Termos de Uso
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.btnAceitar,
              { backgroundColor: termosAceitos ? theme.primary : theme.border },
            ]}
            onPress={handleAceitarTermos}
            disabled={!termosAceitos}
          >
            <Text style={[styles.btnAceitarText, { color: termosAceitos ? '#FFF' : theme.textSecondary }]}>
              Aceitar e Continuar
            </Text>
            <Feather name="arrow-right" size={17} color={termosAceitos ? '#FFF' : theme.textSecondary} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER: Formulário (etapa 1)
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.header}>
            <TouchableOpacity
              style={[styles.backButton, { backgroundColor: theme.iconBackground, borderColor: theme.border }]}
              onPress={() => router.back()}
            >
              <Feather name="arrow-left" color={theme.textSecondary} size={24} />
            </TouchableOpacity>
            <StepIndicator etapa={1} theme={theme} />
          </View>

          <View style={styles.titleSection}>
            <Text style={[styles.title, { color: theme.text }]}>Validação Segura</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Insira o token recebido pelo seu administrador para configurar sua conta.
            </Text>
          </View>

          <View style={styles.form}>
            {/* Token */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Token de Acesso</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="key" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text, letterSpacing: 2 }]}
                  placeholder="XXXX-XXXX-XXXX"
                  placeholderTextColor={theme.textSecondary}
                  value={token}
                  onChangeText={t => setToken(formatarToken(t))}
                  autoCapitalize="characters"
                />
              </View>
            </View>

            {/* Nome */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Nome Completo</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="user" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="Maria Silva"
                  placeholderTextColor={theme.textSecondary}
                  value={nome}
                  onChangeText={setNome}
                />
              </View>
            </View>

            {/* E-mail */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>E-mail</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="mail" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="nome@email.com"
                  placeholderTextColor={theme.textSecondary}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* WhatsApp */}
            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>WhatsApp</Text>
                <View style={[styles.opcionalBadge, { backgroundColor: `${theme.primary}18` }]}>
                  <Text style={[styles.opcionalText, { color: theme.primary }]}>Opcional</Text>
                </View>
              </View>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <View style={[styles.ddiChip, { borderColor: theme.border }]}>
                  <Text style={[styles.ddiText, { color: theme.text }]}>🇧🇷 +55</Text>
                </View>
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="(11) 99999-9999"
                  placeholderTextColor={theme.textSecondary}
                  value={telefone}
                  onChangeText={t => setTelefone(formatarTelefone(t))}
                  keyboardType="phone-pad"
                />
              </View>
              <View style={[styles.infoBox, { backgroundColor: `${theme.primary}08`, borderColor: `${theme.primary}20` }]}>
                <Feather name="message-circle" size={13} color={theme.primary} />
                <Text style={[styles.infoText, { color: theme.primary }]}>
                  Usado apenas para login via WhatsApp. Nunca compartilhado com terceiros.
                </Text>
              </View>
            </View>

            {/* Senha */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Senha Segura</Text>
              <View style={[styles.inputContainer, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <Feather name="lock" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textSecondary}
                  value={senha}
                  onChangeText={v => { setSenha(v); setSenhaForca(calcularForca(v)); }}
                  secureTextEntry={!showPassword}
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={styles.eyeIcon}>
                  <Feather name={showPassword ? 'eye-off' : 'eye'} color={theme.textSecondary} size={20} />
                </TouchableOpacity>
              </View>
              {senha.length > 0 && (
                <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
                  {[0, 1, 2].map(i => (
                    <View key={i} style={{
                      flex: 1, height: 4, borderRadius: 2,
                      backgroundColor: i < senhaForca + 1
                        ? (senhaForca === 0 ? '#EF4444' : senhaForca === 1 ? '#D97706' : '#16A34A')
                        : theme.border,
                    }} />
                  ))}
                </View>
              )}
            </View>

            {/* Confirmar senha */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Confirmar Senha</Text>
              <View style={[styles.inputContainer, {
                backgroundColor: theme.surfaceHighlight,
                borderColor: confirmarSenha.length > 0
                  ? confirmarSenha !== senha ? '#EF4444' : '#10B981'
                  : theme.border,
              }]}>
                <Feather name="lock" color={theme.textSecondary} size={20} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder="••••••••"
                  placeholderTextColor={theme.textSecondary}
                  value={confirmarSenha}
                  onChangeText={setConfirmarSenha}
                  secureTextEntry={!showConfirm}
                />
                <TouchableOpacity onPress={() => setShowConfirm(!showConfirm)} style={styles.eyeIcon}>
                  <Feather name={showConfirm ? 'eye-off' : 'eye'} color={theme.textSecondary} size={20} />
                </TouchableOpacity>
              </View>
              {confirmarSenha.length > 0 && confirmarSenha !== senha && (
                <Text style={{ color: '#EF4444', fontSize: 12, marginTop: 4 }}>As senhas não coincidem</Text>
              )}
              {confirmarSenha.length > 0 && confirmarSenha === senha && (
                <Text style={{ color: '#10B981', fontSize: 12, marginTop: 4 }}>Senhas conferem ✓</Text>
              )}
            </View>

            {error && <ErrorBox msg={error} />}

            <Button variant="primary" loading={loading} onPress={handleValidarFormulario} disabled={loading}>
              Prosseguir para os Termos
            </Button>

            <Button variant="secondary" onPress={() => router.back()}>
              Voltar ao Login
            </Button>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Componentes auxiliares ────────────────────────────────────────────────────

function StepIndicator({ etapa, theme }: { etapa: number; theme: any }) {
  return (
    <View style={{ flexDirection: 'row', gap: 5, alignItems: 'center' }}>
      {[1, 2, 3].map(n => (
        <View
          key={n}
          style={{
            width: n === etapa ? 20 : 7,
            height: 7,
            borderRadius: 4,
            backgroundColor: n === etapa ? theme.primary : n < etapa ? `${theme.primary}50` : theme.border,
          }}
        />
      ))}
    </View>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <View style={errStyles.wrap}>
      <Feather name="alert-circle" size={16} color="#EF4444" />
      <Text style={errStyles.text}>{msg}</Text>
    </View>
  );
}

const errStyles = StyleSheet.create({
  wrap: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(239,68,68,0.08)', borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.2)', borderRadius: 12,
    padding: 12, gap: 8,
  },
  text: { color: '#EF4444', fontSize: 14, flex: 1 },
});

// ─── Styles ────────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { paddingHorizontal: 32, paddingTop: 20, paddingBottom: 40 },
  header: {
    height: 48, justifyContent: 'space-between', alignItems: 'center',
    flexDirection: 'row', marginBottom: 20,
  },
  backButton: { width: 44, height: 44, justifyContent: 'center', borderRadius: 12, alignItems: 'center', borderWidth: 1 },
  titleSection: { marginBottom: 32 },
  title: { fontSize: 32, fontWeight: '700', letterSpacing: -1.0, lineHeight: 40 },
  subtitle: { fontSize: 15, fontWeight: '400', marginTop: 12, lineHeight: 22 },
  form: { gap: 20 },
  fieldGroup: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  opcionalBadge: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 },
  opcionalText: { fontSize: 10, fontWeight: '700' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1, height: 60, paddingHorizontal: 16 },
  inputIcon: { marginRight: 12 },
  input: { flex: 1, fontSize: 16, fontWeight: '500' },
  eyeIcon: { padding: 8 },
  ddiChip: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, marginRight: 10 },
  ddiText: { fontSize: 13, fontWeight: '700' },
  infoBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, borderWidth: 1, borderRadius: 12, padding: 10 },
  infoText: { flex: 1, fontSize: 12, lineHeight: 17 },
  sucessoContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40 },

  /* Termos */
  termosHeader: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 16, borderBottomWidth: 1,
  },
  termosHeaderTitulo: { fontSize: 16, fontWeight: '700' },
  termosHeaderSub: { fontSize: 11, marginTop: 2 },
  termosScroll: { padding: 24, paddingBottom: 40 },
  termosSection: { marginBottom: 24 },
  termosTitulo: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  termosTexto: { fontSize: 14, lineHeight: 22 },
  termosFim: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, paddingTop: 16, marginTop: 8 },
  termosFimText: { fontSize: 12 },
  termosFooter: {
    padding: 20, borderTopWidth: 1, gap: 14,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
  },
  termosAviso: { fontSize: 12, textAlign: 'center', fontStyle: 'italic' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    justifyContent: 'center', alignItems: 'center', marginTop: 1,
  },
  checkLabel: { flex: 1, fontSize: 14, lineHeight: 20 },
  btnAceitar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderRadius: 14, paddingVertical: 16,
  },
  btnAceitarText: { fontSize: 15, fontWeight: '800' },

  /* Permissões */
  permCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    borderRadius: 16, borderWidth: 1, padding: 16,
  },
  permIcon: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  permTitulo: { fontSize: 15, fontWeight: '700' },
  permDesc: { fontSize: 12, marginTop: 2, lineHeight: 17 },
  permBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10 },
  permBtnText: { color: '#FFF', fontSize: 12, fontWeight: '700' },
  permStatus: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  solicitarTodasBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, borderWidth: 1.5, borderRadius: 14, paddingVertical: 14, marginBottom: 16,
  },
  solicitarTodasText: { fontSize: 14, fontWeight: '700' },
});
