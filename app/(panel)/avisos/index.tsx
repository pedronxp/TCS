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
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useTheme } from '../../../context/ThemeContext';
import { useAuth } from '../../../context/AuthContext';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { logger } from '../../../utils/logger';
import { supabase } from '../../../utils/supabase';
import { useBottomTabPadding } from '../../../utils/useBottomTabPadding';
import { AppHeader, Badge, Button, EmptyState, LoadingState } from '../../../components/ui';
import { FontSize, FontWeight } from '../../../constants/Typography';
import { Spacing } from '../../../constants/Spacing';

// Comunicados municipais: lista publicados pela prefeitura (RPC decide escopo
// por organização do usuário). Leitura é registrada ao abrir o comunicado.
// Avisos exigem conexão: não há cache local nesta v1.

type Severidade = 'informacao' | 'alerta' | 'emergencia';

interface ComunicadoApp {
  id: string;
  titulo: string;
  conteudo: string;
  severidade: Severidade;
  status: 'rascunho' | 'publicado' | 'arquivado';
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

  const carregar = useCallback(async (mostrarSpinner: boolean) => {
    if (mostrarSpinner) setCarregando(true);
    setErro(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('portal_list_comunicados');
      if (rpcError) throw rpcError;
      const lista = Array.isArray(data) ? data as ComunicadoApp[] : [];
      setComunicados(lista.filter((item) => item.status === 'publicado'));
    } catch (excecao) {
      logger.warn('notifications', 'Falha ao carregar comunicados', excecao);
      setErro('Não foi possível carregar os avisos agora.');
    } finally {
      setCarregando(false);
      setAtualizando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (isOnlineReal) void carregar(true);
      else {
        setCarregando(false);
        setErro('Os avisos precisam de conexão com a internet.');
      }
    }, [carregar, isOnlineReal]),
  );

  const naoLidos = comunicados.filter((item) => !item.lido).length;

  async function abrir(comunicado: ComunicadoApp) {
    setSelecionado(comunicado);
    if (comunicado.lido) return;
    setComunicados((atual) =>
      atual.map((item) => (item.id === comunicado.id ? { ...item, lido: true } : item)),
    );
    try {
      await supabase.rpc('portal_register_comunicado_leitura', { p_comunicado_id: comunicado.id });
    } catch (excecao) {
      logger.warn('notifications', 'Falha ao registrar leitura', excecao);
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
        subtitle={naoLidos > 0 ? `${naoLidos} não lido${naoLidos === 1 ? '' : 's'}` : 'Comunicados da prefeitura'}
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
        {!carregando && !erro && comunicados.length === 0 && (
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
