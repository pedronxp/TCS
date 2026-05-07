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

export interface PerguntaModel {
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
  skipSe?: SkipSe | null;
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
          imagemLocal: o.imagemKey || o.imagemLocal || null,
          svgKey: o.svgKey || null,
          pesoRisco: o.pesoRisco || 0,
        })),
        skipSe: p.skipSe || null,
      });
    }
  }
  return result;
}
