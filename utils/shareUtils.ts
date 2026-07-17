import { formatarPontuacaoRisco, resolverApresentacaoRisco } from './riscoUtils';

export interface ShareMessageParams {
  protocolo?: string | null;
  endereco: string;
  municipio: string;
  municipio_agente?: string | null;
  nivelRisco: string;
  formularioId?: string | null;
  formularioTitulo?: string | null;
  pontuacaoTotal?: number | null;
  calculoRisco?: unknown;
  agenteNome: string;
  dataVistoria: string;
}

export function buildShareMessage(p: ShareMessageParams): string {
  const apresentacao = resolverApresentacaoRisco({
    formularioId: p.formularioId,
    pontuacao: p.pontuacaoTotal,
    nivelRisco: p.nivelRisco,
    calculoRisco: p.calculoRisco,
  });

  let dataFormatada = '';
  try {
    dataFormatada = new Date(p.dataVistoria).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    dataFormatada = p.dataVistoria;
  }

  const crossMunicipio =
    p.municipio_agente &&
    p.municipio_agente.trim().toLowerCase() !== p.municipio.trim().toLowerCase();

  const linhas: (string | null)[] = [
    `*TCS — Relatório de Risco*`,
    p.protocolo ? `Protocolo: ${p.protocolo}` : null,
    ``,
    `*${p.endereco}*`,
    `Município: ${p.municipio}`,
    crossMunicipio ? `Secretaria de Origem: ${p.municipio_agente}` : null,
    ``,
    p.formularioTitulo ? `Formulário: ${p.formularioTitulo}` : (p.formularioId ? `Formulário: ${p.formularioId}` : null),
    p.pontuacaoTotal !== undefined && p.pontuacaoTotal !== null
      ? `Pontuação: ${formatarPontuacaoRisco(p.pontuacaoTotal)} pontos`
      : null,
    `Resultado: *${apresentacao.label}*`,
    ``,
    `Agente: ${p.agenteNome}`,
    `Data: ${dataFormatada}`,
    ``,
    `_Documento gerado pelo TCS — Relatório de Risco_`,
  ];

  return linhas.filter(l => l !== null).join('\n');
}
