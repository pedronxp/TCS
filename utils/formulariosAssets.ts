export const ASSETS: Record<string, any> = {
  'inspecao_bueiro_drenagem_v1': require('../assets/formularios/inspecao_bueiro_drenagem_v1.json'),
  'inspecao_ponte_passarela_v1': require('../assets/formularios/inspecao_ponte_passarela_v1.json'),
  'risco_incendio_vegetacao_v1': require('../assets/formularios/risco_incendio_vegetacao_v1.json'),
  'risco_inundacao_v1': require('../assets/formularios/risco_inundacao_v1.json'),
  'avaliacao_arvore_cbmmg_v1': require('../assets/formularios/avaliacao_arvore_cbmmg_v1.json'),
  'vistoria_deslizamento_v3': require('../assets/formularios/vistoria_deslizamento_v3.json'),
  'vistoria_deslizamento_v2': require('../assets/formularios/vistoria_deslizamento_v2.json'),
  'risco_estrutural_novo_v2': require('../assets/formularios/risco_estrutural_novo_v2.json'),
  'risco_estrutural_novo_v1': require('../assets/formularios/risco_estrutural_novo_v1.json'),
};

export interface OpcaoModel {
  id: string;
  texto: string;
  descricao?: string;
  imagemLocal?: string | null;
  svgKey?: string | null;
  pesoRisco: number;
  requerJustificativaTecnica?: boolean;
  justificativaTitulo?: string;
  justificativaDescricao?: string;
  justificativaPlaceholder?: string;
}

export interface SkipSe {
  perguntaId: string;
  opcaoId: string;
}

export interface MostrarQuando {
  perguntaId: string;
  opcaoId?: string;
  respostaIds?: string[];
}

export interface FaixaResultadoMetodologia {
  max: number;
  codigo: string;
  label: string;
  nivelCompatibilidade: 'r1' | 'r2' | 'r3' | 'r4';
  cor: string;
  conduta: string;
}

export interface MetodologiaFormulario {
  id: string;
  versao: string;
  titulo: string;
  fonte: string;
  escala: { min: number; max: number; teto: number };
  faixasResultado: FaixaResultadoMetodologia[];
}

export interface ConfiguracaoFormulario {
  id: string;
  titulo: string;
  versao: number;
  featureCode?: string;
  tipoCalculo?: string;
  metodologia?: MetodologiaFormulario;
}

export interface PerguntaModel {
  id: string;
  texto: string;
  descricao?: string;
  faseId?: string;
  grupo?: string;
  instrucao?: string;
  placeholder?: string;
  tipo: 'cards' | 'multipla_escolha' | 'texto' | 'foto';
  tipoEntrada?: 'texto' | 'numero_decimal';
  unidade?: string;
  valorMinimo?: number;
  valorMaximo?: number;
  calculoDerivado?: 'raio_alvo_1_5x';
  validarComPergunta?: string;
  mostrarQuandoPontuacaoMinima?: number;
  mostrarQuandoPontuacaoMaxima?: number;
  layout?: string;
  imagemExemplo?: string | null;
  obrigatoria: boolean;
  auxiliarCalculo?: boolean;
  opcoes: OpcaoModel[];
  skipSe?: SkipSe | null;
  mostrarQuando?: MostrarQuando | null;
}

export const OBSERVACAO_CONDICIONAL_RISCO_SUFFIX = '__observacao_risco';

export function getObservacaoCondicionalRiscoKey(perguntaId: string): string {
  return `${perguntaId}${OBSERVACAO_CONDICIONAL_RISCO_SUFFIX}`;
}

export function getPerguntaIdFromObservacaoCondicionalRiscoKey(key: string): string | null {
  return key.endsWith(OBSERVACAO_CONDICIONAL_RISCO_SUFFIX)
    ? key.slice(0, -OBSERVACAO_CONDICIONAL_RISCO_SUFFIX.length)
    : null;
}

export function getObservacaoCondicionalRiscoConfig(formularioId?: string | null): {
  ativo: boolean;
  pesoMinimo: number;
  titulo?: string;
  descricao?: string;
} | null {
  if (!formularioId) return null;
  const config = ASSETS[formularioId]?.observacaoCondicionalRisco;
  if (!config?.ativo) return null;
  return {
    ativo: true,
    pesoMinimo: Number(config.pesoMinimo ?? 0.3),
    titulo: config.titulo,
    descricao: config.descricao,
  };
}

export function opcaoAcionaObservacaoCondicionalRisco(
  formularioId: string | undefined | null,
  pergunta: Pick<PerguntaModel, 'tipo' | 'auxiliarCalculo' | 'opcoes'> | undefined,
  respostaId: string | undefined,
): boolean {
  if (!pergunta || !respostaId) return false;
  if (pergunta.auxiliarCalculo) return false;
  if (pergunta.tipo !== 'cards' && pergunta.tipo !== 'multipla_escolha') return false;
  const opcao = (pergunta.opcoes || []).find(o => o.id === respostaId);
  if (opcao?.requerJustificativaTecnica) return true;
  const config = getObservacaoCondicionalRiscoConfig(formularioId);
  if (!config) return false;
  return Number(opcao?.pesoRisco ?? 0) >= config.pesoMinimo;
}

export function opcaoRequerJustificativaTecnica(
  pergunta: Pick<PerguntaModel, 'tipo' | 'auxiliarCalculo' | 'opcoes'> | undefined,
  respostaId: string | undefined,
): boolean {
  if (!pergunta || !respostaId) return false;
  if (pergunta.auxiliarCalculo) return false;
  if (pergunta.tipo !== 'cards' && pergunta.tipo !== 'multipla_escolha') return false;
  return Boolean((pergunta.opcoes || []).find(o => o.id === respostaId)?.requerJustificativaTecnica);
}

export function flattenPerguntas(json: any): PerguntaModel[] {
  const result: PerguntaModel[] = [];
  const fases: any[] = json?.fases || [];
  for (const fase of fases) {
    const pergs: any[] = fase?.perguntas || [];
    for (const p of pergs) {
      result.push({
        id: p.id,
        texto: p.texto,
        descricao: p.descricao,
        faseId: fase.id,
        grupo: fase.titulo,
        instrucao: fase.instrucao,
        placeholder: p.placeholder,
        tipo: p.tipo ?? (fase.tipoFase?.startsWith('radio') ? 'cards' : 'texto'),
        tipoEntrada: p.tipoEntrada,
        unidade: p.unidade,
        valorMinimo: p.valorMinimo !== undefined ? Number(p.valorMinimo) : undefined,
        valorMaximo: p.valorMaximo !== undefined ? Number(p.valorMaximo) : undefined,
        calculoDerivado: p.calculoDerivado,
        validarComPergunta: p.validarComPergunta,
        mostrarQuandoPontuacaoMinima: p.mostrarQuandoPontuacaoMinima !== undefined
          ? Number(p.mostrarQuandoPontuacaoMinima)
          : undefined,
        mostrarQuandoPontuacaoMaxima: p.mostrarQuandoPontuacaoMaxima !== undefined
          ? Number(p.mostrarQuandoPontuacaoMaxima)
          : undefined,
        layout: p.layout,
        imagemExemplo: p.imagemLocal || null,
        obrigatoria: p.obrigatoria ?? true,
        auxiliarCalculo: Boolean(p.auxiliarCalculo),
        opcoes: (p.opcoes || []).map((o: any) => ({
          id: o.id,
          texto: o.texto,
          descricao: o.descricao,
          imagemLocal: o.imagemKey || o.imagemLocal || null,
          svgKey: o.svgKey || null,
          pesoRisco: Number(o.pesoRisco ?? 0),
          requerJustificativaTecnica: Boolean(o.requerJustificativaTecnica),
          justificativaTitulo: o.justificativaTitulo,
          justificativaDescricao: o.justificativaDescricao,
          justificativaPlaceholder: o.justificativaPlaceholder,
        })),
        skipSe: p.skipSe || null,
        mostrarQuando: p.mostrarQuando || null,
      });
    }
  }
  return result;
}

export function perguntaEstaVisivel(pergunta: PerguntaModel, respostas: Record<string, string>): boolean {
  if (pergunta.skipSe) {
    const resposta = respostas[pergunta.skipSe.perguntaId];
    if (resposta === pergunta.skipSe.opcaoId) return false;
  }

  if (pergunta.mostrarQuando) {
    const resposta = respostas[pergunta.mostrarQuando.perguntaId];
    const permitidas = pergunta.mostrarQuando.respostaIds
      || (pergunta.mostrarQuando.opcaoId ? [pergunta.mostrarQuando.opcaoId] : []);
    return permitidas.includes(resposta);
  }

  return true;
}

export function perguntaEstaVisivelPorPontuacao(pergunta: PerguntaModel, pontuacao: number): boolean {
  if (pergunta.mostrarQuandoPontuacaoMinima !== undefined && pontuacao < pergunta.mostrarQuandoPontuacaoMinima) {
    return false;
  }
  if (pergunta.mostrarQuandoPontuacaoMaxima !== undefined && pontuacao > pergunta.mostrarQuandoPontuacaoMaxima) {
    return false;
  }
  return true;
}

export function filtrarPerguntasPorPontuacao(perguntas: PerguntaModel[], pontuacao: number): PerguntaModel[] {
  return perguntas.filter(pergunta => perguntaEstaVisivelPorPontuacao(pergunta, pontuacao));
}

export function getConfiguracaoFormulario(formularioId?: string | null): ConfiguracaoFormulario | null {
  if (!formularioId) return null;
  const asset = ASSETS[formularioId];
  if (!asset) return null;
  return {
    id: String(asset.id || formularioId),
    titulo: String(asset.titulo || formularioId),
    versao: Number(asset.versao || 1),
    featureCode: asset.featureCode ? String(asset.featureCode) : undefined,
    tipoCalculo: asset.tipoCalculo ? String(asset.tipoCalculo) : undefined,
    metodologia: asset.metodologia || undefined,
  };
}

export function parseNumeroFormulario(valor: string | number | null | undefined): number | null {
  const normalizado = String(valor ?? '').trim().replace(',', '.');
  if (!normalizado) return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

export function validarValorNumerico(pergunta: PerguntaModel, valor: string | undefined): string | null {
  if (pergunta.tipoEntrada !== 'numero_decimal') return null;
  if (!String(valor ?? '').trim()) return pergunta.obrigatoria ? 'Informe um valor numérico.' : null;
  const numero = parseNumeroFormulario(valor);
  if (numero === null) return 'Informe um número válido.';
  if (pergunta.valorMinimo !== undefined && numero < pergunta.valorMinimo) {
    return `O valor mínimo é ${pergunta.valorMinimo}${pergunta.unidade ? ` ${pergunta.unidade}` : ''}.`;
  }
  if (pergunta.valorMaximo !== undefined && numero > pergunta.valorMaximo) {
    return `O valor máximo é ${pergunta.valorMaximo}${pergunta.unidade ? ` ${pergunta.unidade}` : ''}.`;
  }
  return null;
}

export function calcularRaioAlvoArvore(altura: string | number | null | undefined): number | null {
  const valor = parseNumeroFormulario(altura);
  if (valor === null || valor <= 0) return null;
  return Math.round(valor * 1.5 * 10) / 10;
}

export function validarDiametroArvore(faixa: string | undefined, diametro: string | undefined): string | null {
  if (!String(diametro ?? '').trim()) return null;
  const valor = parseNumeroFormulario(diametro);
  if (valor === null || valor <= 0) return 'Informe um diâmetro positivo em centímetros.';
  if (faixa === 'maior_51' && valor <= 51) return 'O valor deve ser maior que 51 cm para a faixa selecionada.';
  if (faixa === 'entre_10_51' && (valor < 10 || valor > 51)) return 'O valor deve estar entre 10 e 51 cm.';
  if (faixa === 'menor_10' && valor >= 10) return 'O valor deve ser menor que 10 cm para a faixa selecionada.';
  return null;
}

export function validarRespostaFormulario(
  pergunta: PerguntaModel,
  valor: string | undefined,
  respostas: Record<string, string>,
): string | null {
  const preenchida = pergunta.tipo === 'texto'
    ? String(valor ?? '').trim().length > 0
    : Boolean(valor);
  if (pergunta.obrigatoria && !preenchida) return 'Responda esta pergunta para continuar.';
  const erroNumerico = validarValorNumerico(pergunta, valor);
  if (erroNumerico) return erroNumerico;
  if (pergunta.validarComPergunta) {
    return validarDiametroArvore(respostas[pergunta.validarComPergunta], valor);
  }
  return null;
}

export function filtrarPerguntasVisiveis(perguntas: PerguntaModel[], respostas: Record<string, string>): PerguntaModel[] {
  return perguntas.filter(pergunta => perguntaEstaVisivel(pergunta, respostas));
}

export function filtrarRespostasPorPerguntas(
  respostas: Record<string, string>,
  perguntasVisiveis: PerguntaModel[],
  formularioId?: string | null,
): Record<string, string> {
  const visiveis = new Set(perguntasVisiveis.map(pergunta => pergunta.id));
  const perguntaPorId = new Map(perguntasVisiveis.map(pergunta => [pergunta.id, pergunta]));
  return Object.fromEntries(
    Object.entries(respostas).filter(([perguntaId, valor]) => {
      if (visiveis.has(perguntaId)) return true;
      const perguntaBaseId = getPerguntaIdFromObservacaoCondicionalRiscoKey(perguntaId);
      if (!perguntaBaseId || !String(valor ?? '').trim()) return false;
      const perguntaBase = perguntaPorId.get(perguntaBaseId);
      return opcaoAcionaObservacaoCondicionalRisco(
        formularioId,
        perguntaBase,
        respostas[perguntaBaseId],
      );
    }),
  );
}
