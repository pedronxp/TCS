import React, { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { useNotifications } from '../../../context/NotificationContext';
import { useSubscription } from '../../../context/SubscriptionContext';
import { isInternalMobileRole } from '../../../services/AppProfileService';
import { resolveMobileOrganizationAccess } from '../../../services/MobileAccessService';
import { logger } from '../../../utils/logger';
import { supabase } from '../../../utils/supabase';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { AppHeader, Badge, Button, EmptyState, LoadingState, StateBanner } from '../../../components/ui';
import { FontSize, FontWeight } from '../../../constants/Typography';
import { Spacing } from '../../../constants/Spacing';

// Comunicados municipais: lista publicados pela prefeitura (RPC decide escopo
// por organização do usuário). Leitura é registrada ao abrir o comunicado.
// O cache é isolado por usuário e organização para impedir vazamentos entre contas.
const NOTICE_REFRESH_INTERVAL_MS = 45_000;

type Severidade = 'informacao' | 'alerta' | 'emergencia';

interface ComunicadoApp {
  id: string;
  titulo: string;
  conteudo: string;
  severidade: Severidade;
  status: 'rascunho' | 'agendado' | 'publicado' | 'arquivado';
  publicado_em: string | null;
  expira_em: string | null;
  criado_em: string | null;
  lido: boolean;
  destinos: Array<{ bairro_nome: string | null; todo_municipio: boolean }>;
}

const SEVERIDADE_LABEL: Record<Severidade, string> = {
  informacao: 'Informação',
  alerta: 'Alerta',
  emergencia: 'Emergência',
};

function formatarData(value: string | null): string {
  if (!value) return '';
  const data = new Date(value);
  if (Number.isNaN(data.getTime())) return '';
  return data.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function destinoLabel(destinos: ComunicadoApp['destinos']): string {
  if (destinos.some((destino) => destino.todo_municipio)) return 'Todo o município';
  const nomes = destinos
    .map((destino) => destino.bairro_nome)
    .filter((nome): nome is string => nome !== null);
  if (nomes.length === 0) return 'Todo o município';
  return nomes.length <= 2 ? nomes.join(', ') : `${nomes.slice(0, 2).join(', ')} +${nomes.length - 2}`;
}

export default function AvisosScreen() {
  const { theme } = useTheme();
  const { profile } = useAuth();
  const { isOnlineReal } = useConnectivity();
  const { context: subscriptionContext, loading: subscriptionLoading, hasFeature } = useSubscription();
  const { atualizarBadge, hasPermission, pushSupported, solicitarPermissao } = useNotifications();
  const access = resolveMobileOrganizationAccess(profile, subscriptionContext);
  const organizationId = access.organizationId;
  const internalProfile = isInternalMobileRole(profile?.role);
  const noticesEnabled = !subscriptionContext?.features
    || !('comunicados' in subscriptionContext.features)
    || hasFeature('comunicados');
  const noticeCacheKey = profile?.uid && organizationId
    ? `@tcs_avisos_${profile.uid}_${organizationId}`
    : null;
  const pendingReadsKey = profile?.uid && organizationId
    ? `@tcs_avisos_leituras_${profile.uid}_${organizationId}`
    : null;
  // Cadastro de comunicado é exclusivo do painel web; no app apenas
  // admin/master podem disparar um aviso já publicado nas comunidades.
  const podeDisparar = profile?.role === 'admin' || profile?.role === 'master_admin' || profile?.role === 'owner';
  const [disparando, setDisparando] = useState<string | null>(null);
  const [resultadoDisparo, setResultadoDisparo] = useState<string | null>(null);
  const bottomPadding = useBottomTabPadding();
  const [carregando, setCarregando] = useState(true);
  const [atualizando, setAtualizando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [comunicados, setComunicados] = useState<ComunicadoApp[]>([]);
  const [selecionado, setSelecionado] = useState<ComunicadoApp | null>(null);
  const [pedindoPermissao, setPedindoPermissao] = useState(false);

  const ativarNotificacoes = useCallback(async () => {
    if (pedindoPermissao) return;
    setPedindoPermissao(true);
    try {
      await solicitarPermissao();
    } catch (excecao) {
      logger.warn('notifications', 'Não foi possível ativar as notificações do aparelho', excecao);
      setErro('Não foi possível ativar as notificações. Confira sua conexão e tente novamente.');
    } finally {
      setPedindoPermissao(false);
    }
  }, [pedindoPermissao, solicitarPermissao]);

  const persistirComunicados = useCallback(async (lista: ComunicadoApp[]) => {
    if (!noticeCacheKey) return;
    try {
      await AsyncStorage.setItem(noticeCacheKey, JSON.stringify(lista));
    } catch (excecao) {
      logger.warn('notifications', 'Não foi possível atualizar o cache dos avisos', excecao);
    }
  }, [noticeCacheKey]);

  const carregarCache = useCallback(async () => {
    if (!noticeCacheKey) return false;
    try {
      const raw = await AsyncStorage.getItem(noticeCacheKey);
      const cached = raw ? JSON.parse(raw) as unknown : null;
      if (!Array.isArray(cached)) return false;
      const lista = cached as ComunicadoApp[];
      setComunicados(lista);
      return true;
    } catch {
      return false;
    }
  }, [noticeCacheKey]);

  const carregarLeiturasPendentes = useCallback(async (): Promise<string[]> => {
    if (!pendingReadsKey) return [];
    try {
      const raw = await AsyncStorage.getItem(pendingReadsKey);
      const parsed = raw ? JSON.parse(raw) as unknown : [];
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id): id is string => typeof id === 'string');
    } catch {
      return [];
    }
  }, [pendingReadsKey]);

  const salvarLeiturasPendentes = useCallback(async (ids: string[]) => {
    if (!pendingReadsKey) return;
    if (ids.length === 0) {
      await AsyncStorage.removeItem(pendingReadsKey);
      return;
    }
    await AsyncStorage.setItem(pendingReadsKey, JSON.stringify([...new Set(ids)]));
  }, [pendingReadsKey]);

  const enfileirarLeitura = useCallback(async (id: string) => {
    const atuais = await carregarLeiturasPendentes();
    await salvarLeiturasPendentes([...atuais, id]);
  }, [carregarLeiturasPendentes, salvarLeiturasPendentes]);

  const sincronizarLeiturasPendentes = useCallback(async () => {
    const pendentes = await carregarLeiturasPendentes();
    if (!pendentes.length) return;

    const restantes: string[] = [];
    for (const comunicadoId of pendentes) {
      try {
        const { error } = await supabase.rpc('portal_register_comunicado_leitura', {
          p_comunicado_id: comunicadoId,
        });
        if (error) restantes.push(comunicadoId);
      } catch {
        restantes.push(comunicadoId);
      }
    }

    await salvarLeiturasPendentes(restantes);
  }, [carregarLeiturasPendentes, salvarLeiturasPendentes]);

  const carregar = useCallback(async (mostrarSpinner: boolean) => {
    if (!organizationId || !noticesEnabled) {
      setComunicados([]);
      setCarregando(false);
      setAtualizando(false);
      return;
    }
    if (mostrarSpinner) setCarregando(true);
    setErro(null);
    try {
      await sincronizarLeiturasPendentes().catch(() => null);
      const { data, error: rpcError } = await supabase.rpc('portal_list_comunicados');
      if (rpcError) throw rpcError;
      const lista = Array.isArray(data) ? data as ComunicadoApp[] : [];
      const leiturasPendentes = new Set(await carregarLeiturasPendentes());
      const publicados = lista.filter((item) => (
        item.status === 'publicado'
        && (!item.expira_em || new Date(item.expira_em).getTime() > Date.now())
      )).map((item) => (
        leiturasPendentes.has(item.id) ? { ...item, lido: true } : item
      ));
      setComunicados(publicados);
      await persistirComunicados(publicados);
      await atualizarBadge(publicados.filter((item) => !item.lido).length).catch(() => null);
    } catch (excecao) {
      logger.warn('notifications', 'Falha ao carregar comunicados', excecao);
      const cached = await carregarCache();
      if (!cached) setErro('Não foi possível carregar os avisos agora.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, [
    atualizarBadge,
    carregarCache,
    carregarLeiturasPendentes,
    noticesEnabled,
    organizationId,
    persistirComunicados,
    sincronizarLeiturasPendentes,
  ]);

  useFocusEffect(
    useCallback(() => {
      if (subscriptionLoading) return;

      if (!organizationId || !noticesEnabled) {
        setComunicados([]);
        setErro(null);
        setCarregando(false);
        return;
      }

      if (isOnlineReal) {
        void carregar(true);
        const refreshTimer = setInterval(() => void carregar(false), NOTICE_REFRESH_INTERVAL_MS);
        return () => clearInterval(refreshTimer);
      }

      void carregarCache().then((cached) => {
        setCarregando(false);
        if (!cached) setErro('Conecte-se à internet para carregar os comunicados da sua organização.');
      });
    }, [carregar, carregarCache, isOnlineReal, noticesEnabled, organizationId, subscriptionLoading]),
  );

  const naoLidos = comunicados.filter((item) => !item.lido).length;

  async function abrir(comunicado: ComunicadoApp) {
    setSelecionado(comunicado);
    if (comunicado.lido) return;
    const atualizados = comunicados.map((item) => (
      item.id === comunicado.id ? { ...item, lido: true } : item
    ));
    setComunicados(atualizados);
    await persistirComunicados(atualizados);
    await atualizarBadge(atualizados.filter((item) => !item.lido).length).catch(() => null);
    if (!isOnlineReal) {
      await enfileirarLeitura(comunicado.id).catch(() => null);
      return;
    }
    try {
      const { error: leituraError } = await supabase.rpc('portal_register_comunicado_leitura', {
        p_comunicado_id: comunicado.id,
      });
      if (leituraError) throw leituraError;
    } catch (excecao) {
      logger.warn('notifications', 'Falha ao registrar leitura', excecao);
      await enfileirarLeitura(comunicado.id).catch(() => null);
    }
  }

  const severidadeCor: Record<Severidade, string> = {
    informacao: theme.primary,
    alerta: '#C77A00',
    emergencia: '#B91C1C',
  };

  async function disparar(comunicado: ComunicadoApp) {
    setDisparando(comunicado.id);
    setResultadoDisparo(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('portal_disparar_envio_bot', {
        p_comunicado_id: comunicado.id,
      });
      if (rpcError) throw rpcError;
      const total = typeof data === 'number' ? data : 0;
      setResultadoDisparo(total > 0
        ? `${total} disparo${total === 1 ? '' : 's'} na fila do bot.`
        : 'Nenhuma comunidade ativa com chat vinculado no painel web.');
    } catch (excecao) {
      logger.warn('notifications', 'Falha ao disparar pelo bot', excecao);
      setResultadoDisparo('Não foi possível disparar agora. O cadastro de comunidades é feito no painel web.');
    } finally {
      setDisparando(null);
    }
  }

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={['top']}>
      <AppHeader
        title="Avisos"
        subtitle={naoLidos > 0
          ? `${naoLidos} não lido${naoLidos === 1 ? '' : 's'}`
          : subscriptionContext?.organization?.display_name || 'Comunicados da organização'}
      />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingBottom: bottomPadding + Spacing[4] }]}
        refreshControl={
          <RefreshControl
            refreshing={atualizando}
            onRefresh={() => {
              setAtualizando(true);
              void carregar(false);
            }}
            tintColor={theme.primary}
            colors={[theme.primary]}
          />
        }
      >
        {!carregando && organizationId && noticesEnabled && !hasPermission && pushSupported ? (
          <StateBanner
            variant="info"
            title="Receba novos avisos no aparelho"
            description="Autorize as notificações para receber comunicados da sua organização mesmo com o aplicativo fechado."
            actionLabel={pedindoPermissao ? 'Aguarde…' : 'Ativar'}
            onAction={!pedindoPermissao ? () => void ativarNotificacoes() : undefined}
          />
        ) : null}
        {!carregando && organizationId && !pushSupported ? (
          <StateBanner
            variant="info"
            title="Avisos disponíveis dentro do aplicativo"
            description="Notificações push em segundo plano exigem uma versão instalada do aplicativo; elas não funcionam no Expo Go."
          />
        ) : null}
        {carregando && <LoadingState message="Carregando avisos…" />}
        {!carregando && erro && (
          <EmptyState
            icon="cloud-off"
            title="Indisponível no momento"
            description={erro}
            actionLabel={isOnlineReal ? 'Tentar novamente' : undefined}
            onAction={isOnlineReal ? () => void carregar(true) : undefined}
          />
        )}
        {!carregando && !erro && !organizationId && (
          <EmptyState
            icon={internalProfile ? 'briefcase' : 'user'}
            title={internalProfile
              ? 'Selecione uma organização no painel web'
              : access.requiresOrganizationLink
                ? 'Sua conta ainda não está vinculada'
                : 'Sua conta é individual'}
            description={internalProfile
              ? 'Comunicados municipais pertencem a uma organização. Consulte e administre os avisos pelo painel web da TCS.'
              : access.requiresOrganizationLink
                ? 'O responsável precisa vincular sua conta à organização pelo painel web. Após a confirmação, os comunicados serão sincronizados aqui.'
              : 'Comunicados municipais são disponibilizados apenas para contas vinculadas a uma organização.'}
          />
        )}
        {!carregando && !erro && organizationId && !noticesEnabled && (
          <EmptyState
            icon="bell-off"
            title="Avisos indisponíveis para sua conta"
            description="A organização pode administrar os módulos disponíveis exclusivamente pelo painel web."
          />
        )}
        {!carregando && !erro && organizationId && noticesEnabled && comunicados.length === 0 && (
          <EmptyState
            icon="bell-off"
            title="Nenhum aviso publicado"
            description="Quando a prefeitura publicar um comunicado, ele aparece aqui."
          />
        )}
        {!carregando && !erro && comunicados.map((comunicado) => (
          <TouchableOpacity
            key={comunicado.id}
            style={[styles.card, { backgroundColor: theme.surface, borderColor: comunicado.lido ? theme.border : theme.primary }]}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel={`Aviso: ${comunicado.titulo}`}
            onPress={() => void abrir(comunicado)}
          >
            <View style={styles.cardTopo}>
              <View style={[styles.severidadeIndicador, { backgroundColor: severidadeCor[comunicado.severidade] }]} />
              <View style={styles.cardTitulos}>
                <Text style={[styles.cardTitulo, { color: theme.text }]} numberOfLines={2}>
                  {comunicado.titulo}
                </Text>
                <Text style={[styles.cardMeta, { color: theme.textSecondary }]}>
                  {SEVERIDADE_LABEL[comunicado.severidade]} · {destinoLabel(comunicado.destinos)}
                </Text>
              </View>
              {!comunicado.lido && <Badge label="Novo" variant="success" />}
            </View>
            <Text style={[styles.cardResumo, { color: theme.textSecondary }]} numberOfLines={2}>
              {comunicado.conteudo}
            </Text>
            <Text style={[styles.cardData, { color: theme.textSecondary }]}>
              {formatarData(comunicado.publicado_em ?? comunicado.criado_em)}
              {comunicado.expira_em ? ` · expira em ${formatarData(comunicado.expira_em)}` : ''}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <Modal
        visible={selecionado !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelecionado(null)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: theme.background }]}>
            {selecionado && (
              <>
                <View style={styles.modalTopo}>
                  <View style={[styles.severidadeIndicador, { backgroundColor: severidadeCor[selecionado.severidade] }]} />
                  <Text style={[styles.modalTitulo, { color: theme.text }]}>{selecionado.titulo}</Text>
                  <TouchableOpacity
                    onPress={() => setSelecionado(null)}
                    accessibilityRole="button"
                    accessibilityLabel="Fechar aviso"
                    style={[styles.fechar, { backgroundColor: theme.surface }]}
                  >
                    <Feather name="x" size={18} color={theme.text} />
                  </TouchableOpacity>
                </View>
                <Text style={[styles.modalMeta, { color: theme.textSecondary }]}>
                  {SEVERIDADE_LABEL[selecionado.severidade]} · {destinoLabel(selecionado.destinos)} ·{' '}
                  {formatarData(selecionado.publicado_em ?? selecionado.criado_em)}
                </Text>
                <ScrollView showsVerticalScrollIndicator={false} style={styles.modalConteudo}>
                  <Text style={[styles.modalTexto, { color: theme.text }]}>{selecionado.conteudo}</Text>
                </ScrollView>
                {podeDisparar && (
                  <>
                    <Button
                      label={disparando === selecionado.id ? 'Disparando…' : 'Disparar nas comunidades'}
                      onPress={() => void disparar(selecionado)}
                      loading={disparando === selecionado.id}
                      disabled={disparando === selecionado.id}
                    />
                    {resultadoDisparo && (
                      <Text style={[styles.modalMeta, { color: theme.textSecondary }]}>{resultadoDisparo}</Text>
                    )}
                    <Text style={[styles.modalMeta, { color: theme.textSecondary }]}>
                      Criação e agendamento de avisos são feitos no painel web da prefeitura.
                    </Text>
                  </>
                )}
              </>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  content: { padding: Spacing[4], gap: Spacing[3] },
  card: { borderRadius: Spacing[3], borderWidth: 1, padding: Spacing[4], gap: Spacing[2] },
  cardTopo: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  severidadeIndicador: { width: 10, height: 10, borderRadius: 5 },
  cardTitulos: { flex: 1, gap: 2 },
  cardTitulo: { fontSize: FontSize.base, fontWeight: FontWeight.bold },
  cardMeta: { fontSize: FontSize.xs },
  cardResumo: { fontSize: FontSize.sm },
  cardData: { fontSize: FontSize.xs },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: Spacing[5] },
  modalCard: { borderRadius: Spacing[4], padding: Spacing[5], maxHeight: '80%', gap: Spacing[3] },
  modalTopo: { flexDirection: 'row', alignItems: 'center', gap: Spacing[3] },
  modalTitulo: { flex: 1, fontSize: FontSize.lg, fontWeight: FontWeight.extrabold },
  fechar: { borderRadius: 20, width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  modalMeta: { fontSize: FontSize.xs },
  modalConteudo: { flexGrow: 0 },
  modalTexto: { fontSize: FontSize.sm, lineHeight: 21 },
});
