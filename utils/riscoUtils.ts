/**
 * utils/riscoUtils.ts
 * Funções compartilhadas para exibição de nível de risco estrutural.
 * Fonte única da verdade — consolidado de 7 arquivos que tinham cópias inline.
 */

export type NivelRisco = 'r1' | 'r2' | 'r3' | 'r4';

export interface LimiteRisco {
  max: number;
  nivel: string;
}

export const REGRA_RISCO_0_10_V1 = 'risco_0_10_v1';
export const RISCO_ESCALA_MAXIMA = 10;

export const RISCO_0_10_LIMITES: LimiteRisco[] = [
  { max: 2.0, nivel: 'r1' },
  { max: 3.9, nivel: 'r2' },
  { max: 6.9, nivel: 'r3' },
  { max: 10.0, nivel: 'r4' },
];

export interface OpcaoRiscoCalculo {
  id: string;
  texto?: string;
  pesoRisco?: number;
}

export interface PerguntaRiscoCalculo {
  id: string;
  texto?: string;
  faseId?: string;
  grupo?: string;
  tipo: string;
  opcoes?: OpcaoRiscoCalculo[];
}

export interface CalculoRiscoItem {
  perguntaId: string;
  pergunta: string;
  respostaId: string;
  resposta: string;
  pesoRisco: number;
  faseId?: string;
  grupo?: string;
}

export interface CalculoRiscoAgravante {
  id: string;
  label: string;
  descricao: string;
  perguntaId: string;
  respostaId: string;
  pontuacaoMinima: number;
  nivelMinimo: NivelRisco;
}

export interface CalculoRiscoSnapshot {
  versaoRegra: string;
  escala: { min: 0; max: 10 };
  formularioId?: string;
  formularioVersao?: number;
  tipoCalculo: string;
  pontuacaoBase?: number;
  pontuacaoTotal: number;
  nivelRisco: NivelRisco;
  limites: LimiteRisco[];
  itens: CalculoRiscoItem[];
  agravantes?: CalculoRiscoAgravante[];
}

const AGRAVANTE_INCLINACAO_NEGATIVA: CalculoRiscoAgravante = {
  id: 'inclinacao_negativa_talude_solapado',
  label: 'Inclinação negativa / talude solapado',
  descricao: 'Talude com face verticalizada, base erodida/solapada, em balanço ou com perda de apoio visível.',
  perguntaId: 'desl2_q2',
  respostaId: 'q2_f',
  pontuacaoMinima: 7.0,
  nivelMinimo: 'r4',
};

/** Labels de exibição para cada nível de risco */
export const RISCO_LABELS: Record<NivelRisco, string> = {
  r1: 'BAIXO',
  r2: 'MÉDIO',
  r3: 'ALTO',
  r4: 'CRÍTICO',
};

/** Cores de exibição para cada nível de risco */
export const RISCO_CORES: Record<NivelRisco, string> = {
  r1: '#10B981',
  r2: '#F59E0B',
  r3: '#EF4444',
  r4: '#DC2626',
};

const NIVEL_RISCO_MAP: Record<string, NivelRisco> = {
  r1: 'r1',
  sem_risco: 'r1',
  baixo: 'r1',
  muito_baixo: 'r1',
  baixo_risco: 'r1',

  r2: 'r2',
  medio: 'r2',
  medio_baixo: 'r2',
  risco_medio: 'r2',

  r3: 'r3',
  alto: 'r3',
  medio_alto: 'r3',
  risco_alto: 'r3',

  r4: 'r4',
  iminente: 'r4',
  critico: 'r4',
  muito_alto: 'r4',
  risco_critico: 'r4',
};

function normalizarChaveNivel(nivel: string): string {
  return String(nivel || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-\s]+/g, '_');
}

/**
 * Converte códigos e labels legados do JSON para o código interno r1-r4.
 */
export function normalizarNivelRisco(nivel: string | null | undefined, fallback: NivelRisco = 'r1'): NivelRisco {
  return NIVEL_RISCO_MAP[normalizarChaveNivel(nivel || '')] ?? fallback;
}

export function arredondarPontuacaoRisco(valor: number): number {
  const n = Number.isFinite(valor) ? valor : 0;
  return Math.round(n * 10) / 10;
}

export function limitarPontuacaoRisco(valor: number): number {
  return Math.min(RISCO_ESCALA_MAXIMA, Math.max(0, arredondarPontuacaoRisco(valor)));
}

export function formatarPontuacaoRisco(valor: number | null | undefined): string {
  const n = arredondarPontuacaoRisco(Number(valor ?? 0));
  return Number.isInteger(n) ? String(n) : n.toFixed(1).replace('.', ',');
}

/**
 * Classifica uma pontuação usando os limites do formulário.
 * Se não houver limites, usa a régua oficial 0-10.
 */
export function calcularNivelRiscoPorPontuacao(
  pontuacao: number,
  limites?: LimiteRisco[] | null,
): NivelRisco {
  const score = Number.isFinite(pontuacao) ? pontuacao : 0;
  const limitesEfetivos = limites && limites.length > 0 ? limites : RISCO_0_10_LIMITES;

  const sorted = limitesEfetivos
    .filter(l => Number.isFinite(Number(l.max)))
    .map(l => ({ max: Number(l.max), nivel: l.nivel }))
    .sort((a, b) => a.max - b.max);

  for (const limite of sorted) {
    if (score <= limite.max) {
      return normalizarNivelRisco(limite.nivel, 'r1');
    }
  }

  const ultimo = sorted[sorted.length - 1];
  return ultimo ? normalizarNivelRisco(ultimo.nivel, 'r4') : 'r4';
}

function identificarAgravantesCriticos(params: {
  formularioId?: string;
  respostas: Record<string, string>;
}): CalculoRiscoAgravante[] {
  if (
    params.formularioId === 'vistoria_deslizamento_v3'
    && params.respostas[AGRAVANTE_INCLINACAO_NEGATIVA.perguntaId] === AGRAVANTE_INCLINACAO_NEGATIVA.respostaId
  ) {
    return [AGRAVANTE_INCLINACAO_NEGATIVA];
  }

  return [];
}

export function calcularRiscoFormulario(params: {
  perguntas: PerguntaRiscoCalculo[];
  respostas: Record<string, string>;
  limites?: LimiteRisco[] | null;
  formularioId?: string;
  formularioVersao?: number;
  tipoCalculo?: string;
  versaoRegra?: string;
}): CalculoRiscoSnapshot {
  const itens: CalculoRiscoItem[] = [];
  let total = 0;

  for (const pergunta of params.perguntas) {
    if (pergunta.tipo !== 'cards' && pergunta.tipo !== 'multipla_escolha') continue;
    const respostaId = params.respostas[pergunta.id];
    if (!respostaId) continue;

    const opcao = (pergunta.opcoes || []).find(o => o.id === respostaId);
    if (!opcao) continue;

    const peso = arredondarPontuacaoRisco(Number(opcao.pesoRisco ?? 0));
    total += peso;
    itens.push({
      perguntaId: pergunta.id,
      pergunta: pergunta.texto || pergunta.id,
      respostaId: String(respostaId),
      resposta: opcao.texto || String(respostaId),
      pesoRisco: peso,
      faseId: pergunta.faseId,
      grupo: pergunta.grupo,
    });
  }

  const limites = params.limites && params.limites.length > 0 ? params.limites : RISCO_0_10_LIMITES;
  const pontuacaoBase = limitarPontuacaoRisco(total);
  const agravantes = identificarAgravantesCriticos({
    formularioId: params.formularioId,
    respostas: params.respostas,
  });
  const pontuacaoMinimaAgravante = agravantes.reduce(
    (max, agravante) => Math.max(max, agravante.pontuacaoMinima),
    0,
  );
  const pontuacaoTotal = limitarPontuacaoRisco(Math.max(pontuacaoBase, pontuacaoMinimaAgravante));
  let nivelRisco = calcularNivelRiscoPorPontuacao(pontuacaoTotal, limites);
  if (agravantes.some(agravante => agravante.nivelMinimo === 'r4')) {
    nivelRisco = 'r4';
  }

  return {
    versaoRegra: params.versaoRegra || REGRA_RISCO_0_10_V1,
    escala: { min: 0, max: RISCO_ESCALA_MAXIMA },
    formularioId: params.formularioId,
    formularioVersao: params.formularioVersao,
    tipoCalculo: params.tipoCalculo || 'soma_total',
    pontuacaoBase,
    pontuacaoTotal,
    nivelRisco,
    limites,
    itens,
    agravantes,
  };
}

export function parseCalculoRiscoSnapshot(raw: unknown): CalculoRiscoSnapshot | null {
  if (!raw) return null;
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;
    const snapshot = parsed as Partial<CalculoRiscoSnapshot>;
    if (!Array.isArray(snapshot.itens)) return null;
    return {
      versaoRegra: snapshot.versaoRegra || REGRA_RISCO_0_10_V1,
      escala: { min: 0, max: RISCO_ESCALA_MAXIMA },
      formularioId: snapshot.formularioId,
      formularioVersao: snapshot.formularioVersao,
      tipoCalculo: snapshot.tipoCalculo || 'soma_total',
      pontuacaoBase: snapshot.pontuacaoBase !== undefined
        ? limitarPontuacaoRisco(Number(snapshot.pontuacaoBase ?? 0))
        : undefined,
      pontuacaoTotal: limitarPontuacaoRisco(Number(snapshot.pontuacaoTotal ?? 0)),
      nivelRisco: normalizarNivelRisco(snapshot.nivelRisco, 'r1'),
      limites: Array.isArray(snapshot.limites) ? snapshot.limites : RISCO_0_10_LIMITES,
      itens: snapshot.itens.map(item => ({
        perguntaId: String(item.perguntaId || ''),
        pergunta: String(item.pergunta || item.perguntaId || ''),
        respostaId: String(item.respostaId || ''),
        resposta: String(item.resposta || item.respostaId || ''),
        pesoRisco: arredondarPontuacaoRisco(Number(item.pesoRisco ?? 0)),
        faseId: item.faseId,
        grupo: item.grupo,
      })),
      agravantes: Array.isArray(snapshot.agravantes)
        ? snapshot.agravantes.map(agravante => ({
          id: String(agravante.id || ''),
          label: String(agravante.label || ''),
          descricao: String(agravante.descricao || ''),
          perguntaId: String(agravante.perguntaId || ''),
          respostaId: String(agravante.respostaId || ''),
          pontuacaoMinima: limitarPontuacaoRisco(Number(agravante.pontuacaoMinima ?? 0)),
          nivelMinimo: normalizarNivelRisco(agravante.nivelMinimo, 'r4'),
        }))
        : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Retorna o label textual do nível de risco.
 * @param nivel — string r1, r2, r3 ou r4
 */
export function riscoLabel(nivel: string): string {
  return RISCO_LABELS[normalizarNivelRisco(nivel)];
}

/**
 * Retorna a cor hex do nível de risco.
 * @param nivel — string r1, r2, r3 ou r4
 */
export function riscoColor(nivel: string): string {
  return RISCO_CORES[normalizarNivelRisco(nivel)];
}

/**
 * Retorna o ícone Feather adequado para o nível de risco.
 * @param nivel — string r1, r2, r3 ou r4
 */
export function riscoIcon(nivel: string): 'check-circle' | 'alert-circle' | 'alert-triangle' {
  const normalizado = normalizarNivelRisco(nivel);
  if (normalizado === 'r4' || normalizado === 'r3') return 'alert-triangle';
  if (normalizado === 'r2') return 'alert-circle';
  return 'check-circle';
}

/**
 * Texto de conduta recomendada por nível de risco.
 */
export function riscoConduta(nivel: string): string {
  const map: Record<NivelRisco, string> = {
    r1: 'A estrutura apresenta condições adequadas. Recomenda-se monitoramento preventivo periódico e manutenção de rotina.',
    r2: 'Foram identificadas irregularidades. Recomenda-se laudo técnico complementar e medidas de reforço estrutural em curto prazo.',
    r3: 'ATENÇÃO: Risco elevado detectado. Recomenda-se interdição preventiva imediata e evacuação até laudo estrutural por engenheiro habilitado.',
    r4: 'EMERGÊNCIA: Risco crítico à vida. Evacuar imediatamente. Acionar defesa civil municipal e corpo de bombeiros. Interdição obrigatória.',
  };
  return map[normalizarNivelRisco(nivel)];
}
