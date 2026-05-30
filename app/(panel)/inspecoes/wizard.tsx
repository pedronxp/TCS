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
import { insertTrainingVistoria, insertVistoria, markErroSync, markSincronizado, updateAgendamentoVistoriaId, getFormularioCacheById } from '../../../utils/database';
import { useConnectivity } from '../../../context/ConnectivityContext';
import { useAuth } from '../../../context/AuthContext';
import { useTraining } from '../../../context/TrainingContext';
import { notificarVistoriaSalva } from '../../../services/NotificationService';
import { uploadFotoVistoria } from '../../../services/StorageService';
import { updateFotoUrl } from '../../../utils/database';
import { checkRateLimit } from '../../../utils/rateLimitUtils';
import { registrarAuditoria } from '../../../utils/auditLogger';
import { logger } from '../../../utils/logger';
import { generateUUID } from '../../../utils/uuid';
import { safeBack } from '../../../utils/navigationUtils';
import { compressAndPersistImage } from '../../../utils/imageCompression';
import { WizardParams } from '../../../types/vistoria';
import {
  calcularRiscoFormulario,
  CalculoRiscoSnapshot,
  LimiteRisco,
  limitarPontuacaoRisco,
  riscoLabel,
  riscoColor,
} from '../../../utils/riscoUtils';
import {
  ASSETS,
  filtrarPerguntasVisiveis,
  filtrarRespostasPorPerguntas,
  flattenPerguntas,
  getObservacaoCondicionalRiscoConfig,
  getObservacaoCondicionalRiscoKey,
  opcaoAcionaObservacaoCondicionalRisco,
  PerguntaModel,
} from '../../../utils/formulariosAssets';
import { SvgXml } from 'react-native-svg';
import { DESL_SVGS } from '../../../utils/deslizamentoSvgs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

/** Respostas: id_pergunta → { opcaoId | texto_livre } */
type Respostas = Record<string, string>;

export default function WizardAvaliacaoScreen() {
  const params = useLocalSearchParams<Record<string, string>>();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isOnlineReal: isConnected } = useConnectivity();
  const { profile } = useAuth();
  const { session: trainingSession, trainingProfile, isTrainingActive, isExpired, exit, revalidate } = useTraining();
  const activeProfile = profile || trainingProfile;
  const trainingMode = !profile && isTrainingActive && !!trainingProfile;

  const [perguntas, setPerguntas] = useState<PerguntaModel[]>([]);
  const [step, setStep] = useState(0); // índice da pergunta atual
  const [respostas, setRespostas] = useState<Respostas>({});
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [limites, setLimites] = useState<LimiteRisco[]>([]);
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
                  if (draft.step) setStep(draft.step); // clamped on render: perguntasVisiveis[step] ?? step 0
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
        // Formulário personalizado: tentar Supabase se online, senão usar cache SQLite
        let formData: { perguntas: any; classificacao: any; fases: any; tipoCalculo: any } | null = null;

        if (isConnected) {
          const { data, error } = await supabase
            .from('formularios')
            .select('perguntas, classificacao, fases, "tipoCalculo"')
            .eq('id', params.formularioId)
            .single();
          if (!error && data) {
            formData = data;
          }
        }

        // Fallback offline: carregar do cache SQLite com payload completo
        if (!formData) {
          const cached = getFormularioCacheById(params.formularioId);
          if (!cached) throw new Error(`Formulário '${params.formularioId}' não encontrado — conecte-se à internet para baixá-lo.`);
          const perguntas = JSON.parse(cached.perguntas_json || '[]');
          const classificacao = cached.classificacao_json ? JSON.parse(cached.classificacao_json) : null;
          const fases = cached.fases_json ? JSON.parse(cached.fases_json) : null;
          formData = {
            perguntas,
            classificacao,
            fases,
            tipoCalculo: cached.tipo_calculo ?? 'soma_total',
          };
        }

        // Prefer fases (nested format) over flat perguntas
        if (formData.fases && Array.isArray(formData.fases) && formData.fases.length > 0) {
          setPerguntas(flattenPerguntas({ fases: formData.fases }));
          setFaseConfigs(formData.fases.map((f: any) => ({ id: f.id, peso: f.peso ?? 1 })));
        } else {
          let raw = formData.perguntas;
          if (typeof raw === 'string') raw = JSON.parse(raw);
          setPerguntas(Array.isArray(raw) ? raw : flattenPerguntas({ fases: raw }));
        }

        // Load classification limits
        if (formData.classificacao?.limites) {
          setLimites(formData.classificacao.limites);
        }

        if (formData.tipoCalculo) {
          setTipoCalculo(formData.tipoCalculo);
        }
      }
    } catch (e: any) {
      Alert.alert('Erro', e?.message || 'Não foi possível carregar as perguntas. Verifique sua conexão e tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const perguntasVisiveis = useMemo(
    () => filtrarPerguntasVisiveis(perguntas, respostas),
    [perguntas, respostas],
  );
  const respostasVisiveis = useMemo(
    () => filtrarRespostasPorPerguntas(respostas, perguntasVisiveis, params.formularioId),
    [respostas, perguntasVisiveis, params.formularioId],
  );

  const safeStep = Math.min(step, Math.max(0, perguntasVisiveis.length - 1));
  const perguntaAtual = perguntasVisiveis[safeStep];
  const totalPerguntas = perguntasVisiveis.length;
  const progress = totalPerguntas > 0 ? ((safeStep + 1) / totalPerguntas) : 0;

  const resposta = perguntaAtual ? respostasVisiveis[perguntaAtual.id] : undefined;
  const observacaoConfig = getObservacaoCondicionalRiscoConfig(params.formularioId);
  const opcaoSelecionada = perguntaAtual?.opcoes.find(op => op.id === resposta);
  const observacaoCondicionalAtiva = opcaoAcionaObservacaoCondicionalRisco(
    params.formularioId,
    perguntaAtual,
    resposta,
  );
  const observacaoCondicionalKey = perguntaAtual
    ? getObservacaoCondicionalRiscoKey(perguntaAtual.id)
    : '';
  const observacaoCondicionalValor = observacaoCondicionalKey
    ? (respostas[observacaoCondicionalKey] || '')
    : '';

  useEffect(() => {
    if (step !== safeStep) setStep(safeStep);
  }, [safeStep, step]);

  const respostaObrigatoriaPreenchida = (pergunta: PerguntaModel | undefined, valor: string | undefined): boolean => {
    if (!pergunta) return false;
    if (pergunta.tipo === 'texto') return String(valor ?? '').trim().length > 0;
    return !!valor;
  };

  const podeAvancar = () => {
    if (!perguntaAtual?.obrigatoria) return true;
    return respostaObrigatoriaPreenchida(perguntaAtual, resposta);
  };

  const placeholderObservacaoCondicional = () => {
    const peso = Number(opcaoSelecionada?.pesoRisco ?? 0);
    if (peso >= 1) {
      return 'Descreva a evidência crítica, risco imediato, área/pessoas expostas e orientação dada em campo.';
    }
    if (peso >= 0.6) {
      return 'Descreva o dano observado, local exato, evolução aparente, elementos expostos e providência recomendada.';
    }
    return 'Descreva o sinal observado, extensão aproximada e se requer monitoramento ou medida preventiva.';
  };

  const montarSnapshotPonderado = (
    nivel: string,
    pontuacao: number,
  ): CalculoRiscoSnapshot => ({
    versaoRegra: 'ponderada_max_elemento_legacy',
    escala: { min: 0, max: 10 },
    formularioId: params.formularioId,
    formularioVersao: parseInt(params.formularioVersao || '1') || 1,
    tipoCalculo,
    pontuacaoTotal: pontuacao,
    nivelRisco: nivel as CalculoRiscoSnapshot['nivelRisco'],
    limites,
    itens: [],
  });

  const calcularNivelRisco = (
    visiveis: PerguntaModel[] = perguntasVisiveis,
    respostasBase: Respostas = respostasVisiveis,
  ): { nivel: string; pontuacao: number; calculo: CalculoRiscoSnapshot } => {
    // ── Cálculo ponderado por elemento (Risco Estrutural) ─────────────────────
    if (tipoCalculo === 'ponderada_max_elemento') {
      // Acumula score bruto por fase
      const faseRaw: Record<string, number> = {};
      visiveis.forEach(p => {
        if (!p.faseId) return;
        const r = respostasBase[p.id];
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

      if (weighted.length === 0) {
        const calculo = montarSnapshotPonderado('r1', 0);
        return { nivel: 'r1', pontuacao: 0, calculo };
      }

      const maxScore = Math.max(...weighted);
      const mediaScore = weighted.reduce((a, b) => a + b, 0) / weighted.length;
      // Critério: elementos com score > 10 classificados como Alto/Muito Alto
      const countAltoPlus = weighted.filter(s => s > 10).length;

      let nivel: string;
      if (maxScore >= 15 || countAltoPlus >= 2) nivel = 'r4';
      else if (maxScore >= 11) nivel = 'r3';
      else if (maxScore >= 6 || mediaScore >= 6) nivel = 'r2';
      else nivel = 'r1';

      const pontuacao = limitarPontuacaoRisco(maxScore);
      const calculo = montarSnapshotPonderado(nivel, pontuacao);
      return { nivel, pontuacao, calculo };
    }

    const calculo = calcularRiscoFormulario({
      perguntas: visiveis,
      respostas: respostasBase,
      limites,
      formularioId: params.formularioId,
      formularioVersao: parseInt(params.formularioVersao || '1') || 1,
      tipoCalculo,
    });
    return { nivel: calculo.nivelRisco, pontuacao: calculo.pontuacaoTotal, calculo };
  };

  // Risco calculado em tempo real — recalcula a cada resposta
  const riscoAtual = useMemo(() => {
    if (Object.keys(respostas).length === 0) return null;
    return calcularNivelRisco(perguntasVisiveis, respostasVisiveis);
  }, [respostasVisiveis, perguntasVisiveis, limites, tipoCalculo, faseConfigs]);

  // Calcula elemento atual (faseId) para exibição no header
  const elementoAtual = useMemo(() => {
    const p = perguntasVisiveis[safeStep];
    if (!p?.faseId) return null;
    const fasesUnicas = [...new Set(perguntasVisiveis.map(x => x.faseId).filter(Boolean))];
    const idx = fasesUnicas.indexOf(p.faseId);
    return idx >= 0 ? { atual: idx + 1, total: fasesUnicas.length } : null;
  }, [perguntasVisiveis, safeStep]);

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
      const fotoPersistente = await compressAndPersistImage(result.assets[0].uri, {
        directoryName: 'fotos',
        filePrefix: 'vistoria',
      });
      setResposta(perguntaId, fotoPersistente);
    }
  };

  const finalizar = async () => {
    // Verifica obrigatórias
    const pendente = perguntasVisiveis.find(p => p.obrigatoria && !respostaObrigatoriaPreenchida(p, respostasVisiveis[p.id]));
    if (pendente) {
      Alert.alert('Pergunta obrigatória', `Responda: "${pendente.texto}"`);
      const idx = perguntasVisiveis.indexOf(pendente);
      setStep(idx);
      return;
    }

    if (trainingMode && (isExpired() || !(await revalidate()))) {
      await exit();
      router.replace('/(auth)/treinamento');
      return;
    }

    if (!trainingMode && activeProfile?.uid) {
      const { allowed, message } = await checkRateLimit(activeProfile.uid, 'criar_vistoria');
      if (!allowed) {
        Alert.alert('Limite atingido', message || 'Muitas vistorias criadas hoje. Aguarde para continuar.');
        return;
      }
    }

    setSalvando(true);
    try {
      if (!activeProfile?.uid) throw new Error('Perfil não carregado — tente novamente.');

      const { nivel, pontuacao, calculo } = calcularNivelRisco(perguntasVisiveis, respostasVisiveis);
      const agora = new Date().toISOString();

      // UUID via crypto (Hermes suporta desde RN 0.73+)
      const id = generateUUID();

      // Extrair URI da foto das respostas (pergunta do tipo 'foto')
      const perguntaFoto = perguntas.find(p => p.tipo === 'foto');
      const fotoUri = perguntaFoto ? (respostasVisiveis[perguntaFoto.id] || null) : null;

      const municipioVistoria = params.municipio || activeProfile?.municipio || '';
      const vistoriaLocal = {
        id,
        agente_uid: activeProfile.uid,
        agente_nome: activeProfile.name || 'Agente',
        municipio: municipioVistoria,
        municipio_agente: activeProfile?.municipio || null,
        endereco_rua: params.rua || '',
        endereco_numero: params.numero || '',
        endereco_bairro: params.bairro || '',
        endereco_cep: params.cep || null,
        responsavel_nome: params.responsavelNome || null,
        latitude: parseFloat(params.lat || '') || null,
        longitude: parseFloat(params.lng || '') || null,
        data_vistoria: agora,
        formulario_id: params.formularioId,
        formulario_versao: parseInt(params.formularioVersao || '1') || 1,
        respostas_json: JSON.stringify(respostasVisiveis),
        calculo_json: JSON.stringify(calculo),
        nivel_risco: nivel,
        pontuacao_total: pontuacao,
        foto_url: fotoUri,
        laudo_url: null,
        laudo_gerado_em: null,
        feita_online: isConnected ? 1 : 0,
        modo_treinamento: trainingMode ? 1 : 0,
        training_class_id: trainingMode ? trainingSession?.classId ?? null : null,
        training_participant_id: trainingMode ? trainingSession?.participantId ?? null : null,
        criado_em: agora,
      };

      // 1. Salvar localmente primeiro (garante zero perda de dados)
      if (trainingMode) insertTrainingVistoria(vistoriaLocal);
      else insertVistoria(vistoriaLocal);
      logger.info('vistoria', trainingMode ? `Vistoria de treinamento salva localmente — nível ${nivel}` : `Vistoria salva localmente — nível ${nivel}`, {
        id,
        endereco: `${params.rua}, ${params.numero}`,
        pontuacao,
        formulario: params.formularioId,
      });
      if (!trainingMode) {
        registrarAuditoria({
          acao: 'vistoria_criada',
          adminUid: activeProfile.uid,
          adminNome: activeProfile.name || '—',
          adminRole: activeProfile.role,
          municipio: municipioVistoria,
          alvoId: id,
          detalhes: { nivel_risco: nivel, formulario_id: params.formularioId },
        });
        notificarVistoriaSalva(
          `${params.rua}, ${params.numero}`,
          nivel
        ).catch(() => null);
      }

      // 2. Tentar sync imediato se online
      if (isConnected && !trainingMode) {
        // Upload da foto para Storage (não bloqueia o fluxo principal)
        let fotoStorageUrl: string | null = null;
        if (fotoUri && fotoUri.startsWith('file://')) {
          fotoStorageUrl = await uploadFotoVistoria(fotoUri, id, municipioVistoria);
          if (fotoStorageUrl) {
            updateFotoUrl(id, fotoStorageUrl);
          }
        }

        // Nunca enviar file:// ao Supabase — se upload falhou, omitir fotoUrl.
        // O SyncService fará o upload e atualizará o campo quando o app reconectar.
        const fotoUrlRemota = fotoStorageUrl ?? null;
        const midiaLocalPendente = !!fotoUri?.startsWith('file://') && !fotoStorageUrl;

        const { error } = await supabase.from('vistorias').upsert({
          id,
          agenteUid: vistoriaLocal.agente_uid,
          agenteNome: vistoriaLocal.agente_nome,
          municipio: vistoriaLocal.municipio,
          municipio_agente: vistoriaLocal.municipio_agente,
          enderecoRua: vistoriaLocal.endereco_rua,
          enderecoNumero: vistoriaLocal.endereco_numero,
          enderecoBairro: vistoriaLocal.endereco_bairro,
          enderecoCep: vistoriaLocal.endereco_cep,
          responsavelNome: vistoriaLocal.responsavel_nome,
          latitude: vistoriaLocal.latitude ?? null,
          longitude: vistoriaLocal.longitude ?? null,
          dataVistoria: vistoriaLocal.data_vistoria,
          formularioId: vistoriaLocal.formulario_id,
          formularioVersao: vistoriaLocal.formulario_versao,
          respostasJson: vistoriaLocal.respostas_json,
          calculoRisco: calculo,
          nivelRisco: nivel,
          pontuacaoTotal: pontuacao,
          endereco: `${params.rua}, ${params.numero} - ${params.bairro}`,
          fotoUrl: fotoUrlRemota,
          status: 'concluida',
        });
        if (!error) {
          if (midiaLocalPendente) {
            markErroSync(id, 'Dados enviados; mídia local pendente de upload.');
            logger.warn('sync', `Dados sincronizados, mas foto local ficou pendente`, { id });
          } else {
            markSincronizado(id);
            logger.info('sync', `Vistoria sincronizada imediatamente apos salvar`, { id });
          }
        } else {
          logger.warn('sync', `Falha no sync imediato — ficará pendente`, { id, erro: error.message });
        }
      } else {
        logger.info('vistoria', trainingMode ? `Modo treinamento — vistoria mantida somente local` : `Offline — vistoria ficará pendente de sync`, { id });
      }

      // Vincular agendamento à vistoria criada e marcar como concluído
      if (params.agendamentoId && !trainingMode) {
        try {
          updateAgendamentoVistoriaId(params.agendamentoId, id);
          if (isConnected) {
            await supabase
              .from('agendamentos')
              .update({ status: 'concluido', vistoria_id: id })
              .eq('id', params.agendamentoId);
          }
        } catch {
          // não crítico — agendamento pode ser sincronizado depois
        }
      }

      // Limpar rascunho após salvar com sucesso
      AsyncStorage.removeItem(draftKey).catch(() => null);

      router.replace({
        pathname: '/(panel)/inspecoes/resultado',
        params: { id, nivelRisco: nivel, pontuacao: pontuacao.toString(), offline: isConnected ? '0' : '1', municipio: vistoriaLocal.municipio, treinamento: trainingMode ? '1' : '0' }
      });
    } catch (e: any) {
      logger.error('vistoria', 'Erro crítico ao salvar vistoria', { erro: e.message });
      Alert.alert('Erro ao salvar', 'Não foi possível salvar a vistoria. Tente novamente.');
    } finally {
      setSalvando(false);
    }
  };

  const avancar = () => {
    if (!podeAvancar()) {
      Alert.alert('Resposta obrigatória', 'Responda esta pergunta para continuar.');
      return;
    }
    if (safeStep < totalPerguntas - 1) setStep(safeStep + 1);
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
      <View style={[styles.header, { backgroundColor: theme.surfaceHighlight, borderBottomColor: theme.border, paddingTop: insets.top + 12 }]}>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: theme.iconBackground, borderColor: theme.border }]} onPress={() => safeStep > 0 ? setStep(safeStep - 1) : safeBack(trainingMode ? '/(panel)/treinamento' : '/(panel)/inspecoes/selecao-formulario')}>
          <Feather name={safeStep > 0 ? 'arrow-left' : 'x'} size={22} color={theme.textSecondary} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.stepLabel, { color: theme.textSecondary }]}>
            PASSO 3 DE 3 ·{' '}
            {elementoAtual
              ? `ELEMENTO ${elementoAtual.atual}/${elementoAtual.total}`
              : `PERGUNTA ${safeStep + 1}/${totalPerguntas}`}
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
            {perguntaAtual.descricao && (
              <Text style={[styles.questionDesc, { color: theme.textSecondary }]}>{perguntaAtual.descricao}</Text>
            )}


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
                      {/* Imagem de referência: SVG inline (prioridade) ou PNG local/URL */}
                      {op.svgKey && DESL_SVGS[op.svgKey]
                        ? <SvgXml xml={DESL_SVGS[op.svgKey]} width="100%" height={80} style={styles.optionSvg} />
                        : op.imagemLocal && (
                          FORM_IMAGES[op.imagemLocal]
                            ? <Image source={FORM_IMAGES[op.imagemLocal]} style={styles.optionImage} resizeMode="cover" />
                            : (op.imagemLocal.startsWith('http'))
                              ? <Image source={{ uri: op.imagemLocal }} style={styles.optionImage} resizeMode="cover" />
                              : null
                        )
                      }
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

            {observacaoCondicionalAtiva && (
              <View style={[styles.conditionalNote, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border }]}>
                <View style={styles.conditionalNoteHeader}>
                  <Feather name="edit-3" size={15} color={theme.primary} />
                  <Text style={[styles.conditionalNoteTitle, { color: theme.text }]}>
                    {observacaoConfig?.titulo || 'Observação técnica da resposta'}
                  </Text>
                </View>
                <Text style={[styles.conditionalNoteDesc, { color: theme.textSecondary }]}>
                  {`Campo opcional para complementar: ${perguntaAtual.texto} — ${opcaoSelecionada?.texto || resposta}.`}
                </Text>
                <TextInput
                  style={[styles.conditionalNoteInput, { backgroundColor: theme.background, borderColor: theme.border, color: theme.text }]}
                  multiline
                  numberOfLines={4}
                  placeholder={placeholderObservacaoCondicional()}
                  placeholderTextColor={theme.textSecondary}
                  value={observacaoCondicionalValor}
                  onChangeText={t => setResposta(observacaoCondicionalKey, t)}
                  textAlignVertical="top"
                />
              </View>
            )}

            {/* TEXTO LIVRE */}
            {perguntaAtual.tipo === 'texto' && (
              <TextInput
                style={[styles.textArea, { backgroundColor: theme.surfaceHighlight, borderColor: theme.border, color: theme.text }]}
                multiline
                numberOfLines={5}
                placeholder={perguntaAtual.placeholder || 'Digite sua resposta...'}
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
            <TouchableOpacity style={[styles.cancelBtn, { borderColor: theme.border }]} onPress={() => setStep(Math.max(0, safeStep - 1))}>
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
                  <Text style={styles.nextBtnText}>{safeStep < totalPerguntas - 1 ? 'PRÓXIMA' : 'FINALIZAR'}</Text>
                  <Feather name={safeStep < totalPerguntas - 1 ? 'arrow-right' : 'check'} size={18} color="#FFF" />
                </>}
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingBottom: 16, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 16, borderBottomWidth: 1 },
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
  questionDesc: { fontSize: 13, lineHeight: 20, marginTop: -14, marginBottom: 20 },
  optionsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  optionCard: { width: '47%', borderRadius: 14, borderWidth: 1.5, padding: 16, alignItems: 'center', position: 'relative' },
  optionImage: { width: '100%', height: 80, borderRadius: 8, marginBottom: 10 },
  optionSvg: { width: '100%', height: 80, borderRadius: 8, marginBottom: 10, overflow: 'hidden' },
  optionText: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  optionDesc: { fontSize: 12, textAlign: 'center', marginTop: 4 },
  selectedBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  conditionalNote: { marginTop: 18, borderRadius: 14, borderWidth: 1, padding: 14 },
  conditionalNoteHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  conditionalNoteTitle: { fontSize: 14, fontWeight: '800' },
  conditionalNoteDesc: { fontSize: 12, lineHeight: 18, marginBottom: 10 },
  conditionalNoteInput: { minHeight: 96, borderRadius: 10, borderWidth: 1, padding: 12, fontSize: 14, lineHeight: 20 },
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
