export const ASSETS: Record<string, any> = {
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

export interface PerguntaModel {
  id: string;
  texto: string;
  descricao?: string;
  faseId?: string;
  grupo?: string;
  instrucao?: string;
  placeholder?: string;
  tipo: 'cards' | 'multipla_escolha' | 'texto' | 'foto';
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
  const config = getObservacaoCondicionalRiscoConfig(formularioId);
  if (!config || !pergunta || !respostaId) return false;
  if (pergunta.auxiliarCalculo) return false;
  if (pergunta.tipo !== 'cards' && pergunta.tipo !== 'multipla_escolha') return false;
  const opcao = (pergunta.opcoes || []).find(o => o.id === respostaId);
  return Number(opcao?.pesoRisco ?? 0) >= config.pesoMinimo;
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
        imagemExemplo: p.imagemLocal || null,
        obrigatoria: p.obrigatoria ?? true,
        auxiliarCalculo: Boolean(p.auxiliarCalculo),
        opcoes: (p.opcoes || []).map((o: any) => ({
          id: o.id,
          texto: o.texto,
          descricao: o.descricao,
          imagemLocal: o.imagemKey || o.imagemLocal || null,
          svgKey: o.svgKey || null,
          pesoRisco: o.pesoRisco || 0,
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
