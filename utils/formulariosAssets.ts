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
): Record<string, string> {
  const visiveis = new Set(perguntasVisiveis.map(pergunta => pergunta.id));
  return Object.fromEntries(
    Object.entries(respostas).filter(([perguntaId]) => visiveis.has(perguntaId)),
  );
}
