import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, View, Text, StyleSheet, TouchableOpacity, ScrollView, TextInput,
  ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, router } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '../../../context/ThemeContext';
import { supabase } from '../../../utils/supabase';
import { insertVistoria, markSincronizado } from '../../../utils/database';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { useAuth } from '../../../context/AuthContext';
import { notificarVistoriaSalva } from '../../../services/NotificationService';
import { logger } from '../../../utils/logger';
import { generateUUID } from '../../../utils/uuid';
import { WizardParams } from '../../../types/vistoria';
import { riscoLabel, riscoColor } from '../../../utils/riscoUtils';

// Built-in JSON assets
const ASSETS: Record<string, any> = {
  'risco_estrutural_v1': require('../../../assets/formularios/risco_estrutural_v1.json'),
  'risco_estrutural_v2': require('../../../assets/formularios/risco_estrutural_v2.json'),
  'vistoria_deslizamento_v1': require('../../../assets/formularios/vistoria_deslizamento_v1.json'),
};

// Mapa estático de imagens locais dos formulários (require() deve ser estático no RN)
const FORM_IMAGES: Record<string, any> = {
  // Severidade por nível de pesoRisco
  nv0: require('../../../assets/formularios/imagens/nv0.png'),
  nv1: require('../../../assets/formularios/imagens/nv1.png'),
  nv2: require('../../../assets/formularios/imagens/nv2.png'),
  nv3: require('../../../assets/formularios/imagens/nv3.png'),
  nv4: require('../../../assets/formularios/imagens/nv4.png'),
  nv5: require('../../../assets/formularios/imagens/nv5.png'),
  nv6: require('../../../assets/formularios/imagens/nv6.png'),
  // Inclinação de encosta
  inclinacao_10: require('../../../assets/formularios/imagens/inclinacao_10.png'),
  inclinacao_17: require('../../../assets/formularios/imagens/inclinacao_17.png'),
  inclinacao_30: require('../../../assets/formularios/imagens/inclinacao_30.png'),
  inclinacao_60: require('../../../assets/formularios/imagens/inclinacao_60.png'),
  inclinacao_90: require('../../../assets/formularios/imagens/inclinacao_90.png'),
  // Drenagem
  drenagem_ok:       require('../../../assets/formularios/imagens/drenagem_ok.png'),
  drenagem_precaria: require('../../../assets/formularios/imagens/drenagem_precaria.png'),
  drenagem_sem:      require('../../../assets/formularios/imagens/drenagem_sem.png'),
  // Vegetação
  veg_arvores:   require('../../../assets/formularios/imagens/veg_arvores.png'),
  veg_rasteira:  require('../../../assets/formularios/imagens/veg_rasteira.png'),
  veg_desmatada: require('../../../assets/formularios/imagens/veg_desmatada.png'),
  veg_cultivo:   require('../../../assets/formularios/imagens/veg_cultivo.png'),
  // Tipo de terreno
  terreno_natural: require('../../../assets/formularios/imagens/terreno_natural.png'),
  terreno_aterro:  require('../../../assets/formularios/imagens/terreno_aterro.png'),
  // Binários sim/não
  opcao_nao: require('../../../assets/formularios/imagens/opcao_nao.png'),
  opcao_sim: require('../../../assets/formularios/imagens/opcao_sim.png'),
  // Estado de conservacao
  est_bom:          require('../../../assets/formularios/imagens/est_bom.png'),
  est_regular:      require('../../../assets/formularios/imagens/est_regular.png'),
  est_ruim:         require('../../../assets/formularios/imagens/est_ruim.png'),
  est_pessimo:      require('../../../assets/formularios/imagens/est_pessimo.png'),
  // Gravidade
  grav_nenhuma:     require('../../../assets/formularios/imagens/grav_nenhuma.png'),
  grav_leve:        require('../../../assets/formularios/imagens/grav_leve.png'),
  grav_moderada:    require('../../../assets/formularios/imagens/grav_moderada.png'),
  grav_severa:      require('../../../assets/formularios/imagens/grav_severa.png'),
  // Extensao
  ext_pontual:      require('../../../assets/formularios/imagens/ext_pontual.png'),
  ext_setorial:     require('../../../assets/formularios/imagens/ext_setorial.png'),
  ext_generalizada: require('../../../assets/formularios/imagens/ext_generalizada.png'),
  // Estado por elemento — imagens específicas por tipo de dano
  fund_bom:     require('../../../assets/formularios/imagens/fund_bom.png'),
  fund_regular: require('../../../assets/formularios/imagens/fund_regular.png'),
  fund_ruim:    require('../../../assets/formularios/imagens/fund_ruim.png'),
  fund_pessimo: require('../../../assets/formularios/imagens/fund_pessimo.png'),
  muro_bom:     require('../../../assets/formularios/imagens/muro_bom.png'),
  muro_regular: require('../../../assets/formularios/imagens/muro_regular.png'),
  muro_ruim:    require('../../../assets/formularios/imagens/muro_ruim.png'),
  muro_pessimo: require('../../../assets/formularios/imagens/muro_pessimo.png'),
  tal_bom:      require('../../../assets/formularios/imagens/tal_bom.png'),
  tal_regular:  require('../../../assets/formularios/imagens/tal_regular.png'),
  tal_ruim:     require('../../../assets/formularios/imagens/tal_ruim.png'),
  tal_pessimo:  require('../../../assets/formularios/imagens/tal_pessimo.png'),
  dren_bom:     require('../../../assets/formularios/imagens/dren_bom.png'),
  dren_regular: require('../../../assets/formularios/imagens/dren_regular.png'),
  dren_ruim:    require('../../../assets/formularios/imagens/dren_ruim.png'),
  dren_pessimo: require('../../../assets/formularios/imagens/dren_pessimo.png'),
  alv_bom:      require('../../../assets/formularios/imagens/alv_bom.png'),
  alv_regular:  require('../../../assets/formularios/imagens/alv_regular.png'),
  alv_ruim:     require('../../../assets/formularios/imagens/alv_ruim.png'),
  alv_pessimo:  require('../../../assets/formularios/imagens/alv_pessimo.png'),
  cob_bom:      require('../../../assets/formularios/imagens/cob_bom.png'),
  cob_regular:  require('../../../assets/formularios/imagens/cob_regular.png'),
  cob_ruim:     require('../../../assets/formularios/imagens/cob_ruim.png'),
  cob_pessimo:  require('../../../assets/formularios/imagens/cob_pessimo.png'),
};

// ─── Types (mapeados de formulario_model.dart) ────────────────────────────────

interface OpcaoModel {
  id: string;
  texto: string;
  descricao?: string;
  imagemLocal?: string | null;  // chave do FORM_IMAGES ou URL http/https
  pesoRisco: number;
}

interface SkipSe {
  perguntaId: string;
  opcaoId: string;
}

interface PerguntaModel {
  id: string;
  texto: string;
  faseId?: string;
  grupo?: string;
  instrucao?: string;
  tipo: 'cards' | 'multipla_escolha' | 'texto' | 'foto';
  layout?: string;
  imagemExemplo?: string | null;
  obrigatoria: boolean;
  opcoes: OpcaoModel[];
  skipSe?: SkipSe | null;   // pula esta pergunta se respostas[perguntaId] === opcaoId
}

/** Respostas: id_pergunta → { opcaoId | texto_livre } */
type Respostas = Record<string, string>;

export default function WizardAvaliacaoScreen() {
  const params = useLocalSearchParams<Record<string, string>>();
  const { theme } = useTheme();
  const { isOnlineReal: isConnected } = useConnectivity();
  const { profile } = useAuth();

  const [perguntas, setPerguntas] = useState<PerguntaModel[]>([]);
  const [step, setStep] = useState(0); // índice da pergunta atual
  const [respostas, setRespostas] = useState<Respostas>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [limites, setLimites] = useState<{max: number; nivel: string}[]>([]);
  const [tipoCalculo, setTipoCalculo] = useState<string>('soma_total');
  const [faseConfigs, setFaseConfigs] = useState<{id: string; peso: number}[]>([]);
  const draftKey = `@draft_wizard_${params.formularioId}_v${params.formularioVersao || '1'}`;
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const riscoAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    fetchPerguntas();
  }, []);

  // Carregar rascunho ao abrir
  useEffect(() => {
    AsyncStorage.getItem(draftKey).then(raw => {
      if (raw) {
        try {
          const draft = JSON.parse(raw);
          if (draft.respostas && Object.keys(draft.respostas).length > 0) {
            Alert.alert(
              'Rascunho encontrado',
              'Você tem respostas salvas deste formulário. Deseja continuar de onde parou?',
              [
                { text: 'Descartar', style: 'destructive', onPress: () => AsyncStorage.removeItem(draftKey) },
                { text: 'Continuar', onPress: () => {
                  setRespostas(draft.respostas);
                  if (draft.step) setStep(draft.step);
                }},
              ]
            );
          }
        } catch { /* draft inválido */ }
      }
    });
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  // Auto-save debounced a cada mudança nas respostas
  const setResposta = (perguntaId: string, valor: string) => {
    setRespostas(r => {
      const updated = { ...r, [perguntaId]: valor };
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      autoSaveTimer.current = setTimeout(() => {
        AsyncStorage.setItem(draftKey, JSON.stringify({ respostas: updated, step })).catch(() => null);
      }, 800);
      return updated;
    });
  };

  /**
   * Carrega as perguntas do formulário.
   * - Se isBuiltin=true: carrega do JSON asset local (offline)
   * - Se isBuiltin=false: carrega da tabela `formularios` no Supabase
   *
   * O JSON built-in usa `fases[].perguntas[]` (format herdado do Flutter).
   * O Supabase pode usar `perguntas[]` flat OR `fases[]`.
   * Ambos são aplanados em uma lista única de PerguntaModel.
   */
  const fetchPerguntas = async () => {
    try {
      if (params.isBuiltin === 'true') {
        const json = ASSETS[params.formularioId];
        if (!json) throw new Error(`Formulário builtin '${params.formularioId}' não encontrado`);
        const flat = flattenPerguntas(json);
        setPerguntas(flat);
        setLimites(json?.classificacao?.limites || []);
        setTipoCalculo(json?.tipoCalculo || 'soma_total');
        setFaseConfigs((json?.fases || []).map((f: any) => ({ id: f.id, peso: f.peso ?? 1 })));
      } else {
        const { data, error } = await supabase
          .from('formularios')
          .select('perguntas, classificacao, fases, "tipoCalculo"')
          .eq('id', params.formularioId)
          .single();
        if (error) throw error;

        // Prefer fases (nested format) over flat perguntas
        if (data?.fases && Array.isArray(data.fases) && data.fases.length > 0) {
          setPerguntas(flattenPerguntas({ fases: data.fases }));
        } else {
          let raw = data?.perguntas;
          if (typeof raw === 'string') raw = JSON.parse(raw);
          setPerguntas(Array.isArray(raw) ? raw : flattenPerguntas({ fases: raw }));
        }

        // Load classification limits
        if (data?.classificacao?.limites) {
          setLimites(data.classificacao.limites);
        }
      }
    } catch (e: any) {
      Alert.alert('Erro', `Não foi possível carregar as perguntas: ${e.message}`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Aplana `fases[].perguntas[]` em uma lista única de PerguntaModel.
   * Cada fase tem um título que se torna o 'grupo' da pergunta.
   */
  const flattenPerguntas = (json: any): PerguntaModel[] => {
    const result: PerguntaModel[] = [];
    const fases: any[] = json?.fases || [];
    for (const fase of fases) {
      const pergs: any[] = fase?.perguntas || [];
      for (const p of pergs) {
        result.push({
          id: p.id,
          texto: p.texto,
          faseId: fase.id,
          grupo: fase.titulo,
          instrucao: fase.instrucao,
          tipo: p.tipo ?? (fase.tipoFase?.startsWith('radio') ? 'cards' : 'texto'),
          imagemExemplo: p.imagemLocal || null,
          obrigatoria: p.obrigatoria ?? true,
          opcoes: (p.opcoes || []).map((o: any) => ({
            id: o.id,
            texto: o.texto,
            descricao: o.descricao,
            imagemLocal: o.imagemLocal || null,
            pesoRisco: o.pesoRisco || 0,
          })),
          skipSe: p.skipSe || null,
        });
      }
    }
    return result;
  };

  const perguntasVisiveis = useMemo(() =>
    perguntas.filter(p => {
      if (!p.skipSe) return true;
      const resposta = respostas[p.skipSe.perguntaId];
      return resposta !== p.skipSe.opcaoId;
    }),
    [perguntas, respostas]
  );

  const perguntaAtual = perguntasVisiveis[step];
  const totalPerguntas = perguntasVisiveis.length;
  const progress = totalPerguntas > 0 ? ((step + 1) / totalPerguntas) : 0;

  const resposta = perguntaAtual ? respostas[perguntaAtual.id] : undefined;

  const podeAvancar = () => {
    if (!perguntaAtual?.obrigatoria) return true;
    return !!resposta;
  };

  const calcularNivelRisco = (visiveis: PerguntaModel[] = perguntasVisiveis): { nivel: string; pontuacao: number } => {
    const nivelMap: Record<string, string> = {
      sem_risco: 'r1', baixo: 'r1', muito_baixo: 'r1',
      medio: 'r2', medio_baixo: 'r2',
      alto: 'r3', medio_alto: 'r3',
      iminente: 'r4', critico: 'r4', muito_alto: 'r4',
    };

    // ── Cálculo ponderado por elemento (Risco Estrutural) ─────────────────────
    if (tipoCalculo === 'ponderada_max_elemento') {
      // Acumula score bruto por fase
      const faseRaw: Record<string, number> = {};
      visiveis.forEach(p => {
        if (!p.faseId) return;
        const r = respostas[p.id];
        if (r && (p.tipo === 'cards' || p.tipo === 'multipla_escolha')) {
          const opcao = p.opcoes.find(o => o.id === r);
          if (opcao && opcao.pesoRisco > 0) {
            faseRaw[p.faseId] = (faseRaw[p.faseId] || 0) + opcao.pesoRisco;
          }
        }
      });

      // Aplica peso de cada elemento: score_elemento = raw × peso
      const weighted = Object.entries(faseRaw).map(([faseId, raw]) => {
        const cfg = faseConfigs.find(f => f.id === faseId);
        return raw * (cfg?.peso ?? 1);
      });

      if (weighted.length === 0) return { nivel: 'r1', pontuacao: 0 };

      const maxScore = Math.max(...weighted);
      const mediaScore = weighted.reduce((a, b) => a + b, 0) / weighted.length;
      // Critério: elementos com score > 10 classificados como Alto/Muito Alto
      const countAltoPlus = weighted.filter(s => s > 10).length;

      let nivel: string;
      if (maxScore >= 15 || countAltoPlus >= 2) nivel = 'r4';
      else if (maxScore >= 11) nivel = 'r3';
      else if (maxScore >= 6 || mediaScore >= 6) nivel = 'r2';
      else nivel = 'r1';

      return { nivel, pontuacao: Math.round(maxScore * 10) / 10 };
    }

    // ── Cálculo soma total (padrão) ───────────────────────────────────────────
    let pontuacao = 0;
    visiveis.forEach(p => {
      const r = respostas[p.id];
      if (r && (p.tipo === 'cards' || p.tipo === 'multipla_escolha')) {
        const opcao = p.opcoes.find(o => o.id === r);
        if (opcao) pontuacao += opcao.pesoRisco;
      }
    });

    if (limites.length > 0) {
      const sorted = [...limites].sort((a, b) => a.max - b.max);
      for (const l of sorted) {
        if (pontuacao <= l.max) {
          return { nivel: nivelMap[l.nivel] || 'r2', pontuacao };
        }
      }
      return { nivel: 'r4', pontuacao };
    }

    // Fallback hardcoded
    let nivel = 'r1';
    if (pontuacao >= 75) nivel = 'r4';
    else if (pontuacao >= 50) nivel = 'r3';
    else if (pontuacao >= 25) nivel = 'r2';
    return { nivel, pontuacao };
  };

  // Risco calculado em tempo real — recalcula a cada resposta
  const riscoAtual = useMemo(() => {
    if (Object.keys(respostas).length === 0) return null;
    return calcularNivelRisco(perguntasVisiveis);
  }, [respostas, perguntasVisiveis, limites, tipoCalculo, faseConfigs]);

  // Calcula elemento atual (faseId) para exibição no header
  const elementoAtual = useMemo(() => {
    const p = perguntasVisiveis[step];
    if (!p?.faseId) return null;
    const fasesUnicas = [...new Set(perguntasVisiveis.map(x => x.faseId).filter(Boolean))];
    const idx = fasesUnicas.indexOf(p.faseId);
    return idx >= 0 ? { atual: idx + 1, total: fasesUnicas.length } : null;
  }, [perguntasVisiveis, step]);

  // Anima entrada/saída do banner quando riscoAtual muda
  useEffect(() => {
    Animated.timing(riscoAnim, {
      toValue: riscoAtual ? 1 : 0,
      duration: 220,
      useNativeDriver: true,
    }).start();
  }, [riscoAtual]);

  const tirarFoto = async (perguntaId: string) => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permissão negada', 'É necessário permitir o acesso à câmera para tirar fotos.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (!result.canceled && result.assets[0]) {
      setResposta(perguntaId, result.assets[0].uri);
    }
  };

  const finalizar = async () => {
    // Verifica obrigatórias
    const pendente = perguntasVisiveis.find(p => p.obrigatoria && !respostas[p.id]);
    if (pendente) {
      Alert.alert('Pergunta obrigatória', `Responda: "${pendente.texto}"`);
      const idx = perguntasVisiveis.indexOf(pendente);
      setStep(idx);
      return;
    }

    setSalvando(true);
    try {
      if (!profile?.uid) throw new Error('Perfil não carregado — tente novamente.');

      const { nivel, pontuacao } = calcularNivelRisco(perguntasVisiveis);
      const agora = new Date().toISOString();

      // UUID via crypto (Hermes suporta desde RN 0.73+)
      const id = generateUUID();

      // Extrair URI da foto das respostas (pergunta do tipo 'foto')
      const perguntaFoto = perguntas.find(p => p.tipo === 'foto');
      const fotoUri = perguntaFoto ? (respostas[perguntaFoto.id] || null) : null;

      const vistoriaLocal = {
        id,
        agente_uid: profile.uid,
        agente_nome: profile.name || 'Agente',
        municipio: profile?.municipio || params.municipio || '',
        endereco_rua: params.rua || '',
        endereco_numero: params.numero || '',
        endereco_bairro: params.bairro || '',
        endereco_cep: params.cep || null,
        responsavel_nome: params.responsavelNome || null,
        latitude: parseFloat(params.lat || '0') || 0,
        longitude: parseFloat(params.lng || '0') || 0,
        data_vistoria: agora,
        formulario_id: params.formularioId,
        formulario_versao: parseInt(params.formularioVersao || '1') || 1,
        respostas_json: JSON.stringify(respostas),
        nivel_risco: nivel,
        pontuacao_total: pontuacao,
        foto_url: fotoUri,
        criado_em: agora,
      };

      // 1. Salvar localmente primeiro (garante zero perda de dados)
      insertVistoria(vistoriaLocal);
      logger.info('vistoria', `Vistoria salva localmente — nível ${nivel}`, {
        id,
        endereco: `${params.rua}, ${params.numero}`,
        pontuacao,
        formulario: params.formularioId,
      });
      notificarVistoriaSalva(
        `${params.rua}, ${params.numero}`,
        nivel
      ).catch(() => null);

      // 2. Tentar sync imediato se online
      if (isConnected) {
        const { error } = await supabase.from('vistorias').upsert({
          id,
          agenteUid: vistoriaLocal.agente_uid,
          agenteNome: vistoriaLocal.agente_nome,
          municipio: vistoriaLocal.municipio,
          enderecoRua: vistoriaLocal.endereco_rua,
          enderecoNumero: vistoriaLocal.endereco_numero,
          enderecoBairro: vistoriaLocal.endereco_bairro,
          enderecoCep: vistoriaLocal.endereco_cep,
          responsavelNome: vistoriaLocal.responsavel_nome,
          latitude: vistoriaLocal.latitude,
          longitude: vistoriaLocal.longitude,
          dataVistoria: vistoriaLocal.data_vistoria,
          formularioId: vistoriaLocal.formulario_id,
          formularioVersao: vistoriaLocal.formulario_versao,
          respostasJson: vistoriaLocal.respostas_json,
          nivelRisco: nivel,
          pontuacaoTotal: pontuacao,
          endereco: `${params.rua}, ${params.numero} - ${params.bairro}`,
        });
        if (!error) {
          markSincronizado(id);
          logger.info('sync', `Vistoria sincronizada imediatamente após salvar`, { id });
        } else {
          logger.warn('sync', `Falha no sync imediato — ficará pendente`, { id, erro: error.message });
        }
      } else {
        logger.info('vistoria', `Offline — vistoria ficará pendente de sync`, { id });
      }

      // Limpar rascunho após salvar com sucesso
      AsyncStorage.removeItem(draftKey).catch(() => null);

      router.replace({
        pathname: '/(panel)/inspecoes/resultado',
        params: { id, nivelRisco: nivel, pontuacao: pontuacao.toString(), offline: isConnected ? '0' : '1' }
      });
    } catch (e: any) {
      logger.error('vistoria', 'Erro crítico ao salvar vistoria', { erro: e.message });
      Alert.alert('Erro ao salvar', e.message || 'Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const avancar = () => {
    if (!podeAvancar()) {
      Alert.alert('Resposta obrigatória', 'Responda esta pergunta para continuar.');
      return;
    }
    if (step < totalPerguntas - 1) setStep(s => s + 1);
    else finalizar();
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.textSecondary, marginTop: 16 }}>Carregando formulário...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={[styles.container, { backgroundColor: theme.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]} onPress={() => step > 0 ? setStep(s => s - 1) : router.back()}>
          <Feather name={step > 0 ? 'arrow-left' : 'x'} size={22} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>
            PASSO 3 DE 3 ·{' '}
            {elementoAtual
              ? `ELEMENTO ${elementoAtual.atual}/${elementoAtual.total}`
              : `PERGUNTA ${step + 1}/${totalPerguntas}`}
          </Text>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{params.formularioTitulo}</Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={[styles.progressTrack, { backgroundColor: theme.cardBorder }]}>
        <View style={[styles.progressFill, { backgroundColor: theme.primary, width: `${progress * 100}%` }]} />
      </View>

      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {perguntaAtual && (
          <>
            {/* Image example */}
            {perguntaAtual.imagemExemplo && (
              <Image source={{ uri: perguntaAtual.imagemExemplo }} style={styles.exampleImage} resizeMode="cover" />
            )}

            {/* Phase group label */}
            {perguntaAtual.grupo && (
              <View style={[styles.groupLabel, { backgroundColor: theme.iconBackground }]}>
                <Feather name="layers" size={12} color={theme.primary} />
                <Text style={[styles.groupText, { color: theme.primary }]}>{perguntaAtual.grupo}</Text>
              </View>
            )}

            {/* Instrucao (phase instruction text) */}
            {perguntaAtual.instrucao && (
              <Text style={[styles.instrucao, { color: theme.textSecondary }]}>{perguntaAtual.instrucao}</Text>
            )}

            <Text style={[styles.question, { color: theme.text }]}>
              {perguntaAtual.texto}
              {perguntaAtual.obrigatoria && <Text style={{ color: '#EF4444' }}> *</Text>}
            </Text>


            {/* CARDS / MULTIPLA ESCOLHA */}
            {(perguntaAtual.tipo === 'cards' || perguntaAtual.tipo === 'multipla_escolha') && (
              <View style={styles.optionsGrid}>
                {perguntaAtual.opcoes.map(op => {
                  const sel = resposta === op.id;
                  return (
                    <TouchableOpacity
                      key={op.id}
                      style={[
                        styles.optionCard,
                        { backgroundColor: theme.surfaceHighlight, borderColor: sel ? theme.primary : theme.cardBorder }
                      ]}
                      onPress={() => setResposta(perguntaAtual.id, op.id)}
                    >
                      {/* Imagem de referência: local (FORM_IMAGES) ou URL remota */}
                      {op.imagemLocal && (
                        FORM_IMAGES[op.imagemLocal]
                          ? <Image source={FORM_IMAGES[op.imagemLocal]} style={styles.optionImage} resizeMode="cover" />
                          : (op.imagemLocal.startsWith('http'))
                            ? <Image source={{ uri: op.imagemLocal }} style={styles.optionImage} resizeMode="cover" />
                            : null
                      )}
                      <Text style={[styles.optionText, { color: sel ? theme.primary : theme.text }]}>{op.texto}</Text>
                      {op.descricao && <Text style={[styles.optionDesc, { color: theme.textSecondary }]}>{op.descricao}</Text>}
                      {sel && (
                        <View style={[styles.selectedBadge, { backgroundColor: theme.primary }]}>
                          <Feather name="check" size={12} color="#FFF" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            {/* TEXTO LIVRE */}
            {perguntaAtual.tipo === 'texto' && (
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border, color: theme.text }]}
                multiline
                numberOfLines={5}
                placeholder="Digite sua resposta..."
                placeholderTextColor={theme.textSecondary}
                value={resposta || ''}
                onChangeText={t => setResposta(perguntaAtual.id, t)}
                textAlignVertical="top"
              />
            )}

            {/* FOTO */}
            {perguntaAtual.tipo === 'foto' && (
              <View>
                {resposta ? (
                  <TouchableOpacity onPress={() => tirarFoto(perguntaAtual.id)} style={styles.fotoPreviewWrap}>
                    <Image source={{ uri: resposta }} style={styles.fotoPreview} resizeMode="cover" />
                    <View style={styles.fotoOverlay}>
                      <Feather name="camera" size={18} color="#FFF" />
                      <Text style={styles.fotoOverlayText}>Trocar foto</Text>
                    </View>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    style={[styles.fotoButton, { backgroundColor: theme.surfaceHighlight, borderColor: theme.primary }]}
                    onPress={() => tirarFoto(perguntaAtual.id)}
                  >
                    <Feather name="camera" size={32} color={theme.primary} />
                    <Text style={[styles.fotoButtonText, { color: theme.primary }]}>Tirar Foto</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </>
        )}

        {totalPerguntas === 0 && !loading && (
          <View style={styles.emptyState}>
            <Feather name="alert-circle" size={48} color={theme.border} />
            <Text style={[{ color: theme.textSecondary, textAlign: 'center', marginTop: 16 }]}>
              Este formulário não possui perguntas ainda.{'\n'}Contate um Administrador.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* Footer */}
      <View style={[styles.footer, { backgroundColor: theme.surfaceHighlight, borderTopColor: theme.border }]}>
        {/* Banner de risco em tempo real — aparece após primeira resposta */}
        {riscoAtual && (
          <Animated.View
            style={[
              styles.riscoBanner,
              {
                backgroundColor: riscoColor(riscoAtual.nivel) + '1A',
                borderColor: riscoColor(riscoAtual.nivel),
                opacity: riscoAnim,
                transform: [{ translateY: riscoAnim.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
              },
            ]}
          >
            <Feather name={riscoAtual.nivel === 'r4' || riscoAtual.nivel === 'r3' ? 'alert-triangle' : 'shield'} size={16} color={riscoColor(riscoAtual.nivel)} />
            <Text style={[styles.riscoBannerLabel, { color: riscoColor(riscoAtual.nivel) }]}>
              RISCO ATUAL
            </Text>
            <Text style={[styles.riscoBannerNivel, { color: riscoColor(riscoAtual.nivel) }]}>
              {riscoAtual.nivel.toUpperCase()} — {riscoLabel(riscoAtual.nivel)}
            </Text>
          </Animated.View>
        )}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {step > 0 && (
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={() => setStep(s => s - 1)}>
              <Text style={[styles.cancelText, { color: theme.textSecondary }]}>VOLTAR</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={[styles.nextBtn, { backgroundColor: theme.primary, flex: step > 0 ? 2 : 1 }]}
            onPress={avancar}
            disabled={salvando}
          >
            {salvando
              ? <ActivityIndicator size="small" color="#FFF" />
              : <>
                  <Text style={styles.nextBtnText}>{step < totalPerguntas - 1 ? 'PRÓXIMA' : 'FINALIZAR'}</Text>
                  <Feather name={step < totalPerguntas - 1 ? 'arrow-right' : 'check'} size={18} color="#FFF" />
                </>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingTop: 60, paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1 },
  backBtn: { width: 44, height: 44, borderRadius: 12, borderWidth: 1, justifyContent: 'center', alignItems: 'center' },
  stepLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  title: { fontSize: 18, fontWeight: '700', letterSpacing: -0.3 },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
  scroll: { padding: 20, paddingBottom: 120 },
  groupLabel: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginBottom: 8 },
  groupText: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  instrucao: { fontSize: 14, lineHeight: 22, marginBottom: 12 },
  exampleImage: { width: '100%', height: 180, borderRadius: 14, marginBottom: 20 },
  question: { fontSize: 20, fontWeight: '700', lineHeight: 28, marginBottom: 24 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  optionCard: { width: '47%', borderRadius: 14, borderWidth: 1.5, padding: 16, alignItems: 'center', position: 'relative' },
  optionImage: { width: '100%', height: 80, borderRadius: 8, marginBottom: 10 },
  optionText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  optionDesc: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  selectedBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  textArea: { borderRadius: 14, borderWidth: 1, padding: 16, fontSize: 15, minHeight: 140 },
  fotoButton: { height: 160, borderRadius: 14, borderWidth: 1.5, borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center', gap: 12 },
  fotoButtonText: { fontSize: 15, fontWeight: '600' },
  fotoPreviewWrap: { borderRadius: 14, overflow: 'hidden', position: 'relative' },
  fotoPreview: { width: '100%', height: 220, borderRadius: 14 },
  fotoOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.45)', flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, paddingVertical: 12 },
  fotoOverlayText: { color: '#FFF', fontWeight: '600', fontSize: 14 },
  emptyState: { alignItems: 'center', justifyContent: 'center', marginTop: 60 },
  footer: { padding: 20, paddingBottom: 36, borderTopWidth: 1, flexDirection: 'column', gap: 0 },
  cancelBtn: { flex: 1, height: 56, borderRadius: 14, borderWidth: 1.5, justifyContent: 'center', alignItems: 'center' },
  cancelText: { fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  nextBtn: { height: 56, borderRadius: 14, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  nextBtnText: { color: '#FFF', fontSize: 13, fontWeight: '800', letterSpacing: 1 },
  riscoBanner: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 12,
  },
  riscoBannerLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.2,
  },
  riscoBannerNivel: {
    fontSize: 13,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
});
