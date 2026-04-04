import { riscoLabel } from './riscoUtils';

export interface ShareMessageParams {
  protocolo?: string | null;
  endereco: string;
  municipio: string;
  municipio_agente?: string | null;
  nivelRisco: string;
  agenteNome: string;
  dataVistoria: string;
}

export function buildShareMessage(p: ShareMessageParams): string {
  const risco = riscoLabel(p.nivelRisco);

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
    `Nível de Risco: *${risco}*`,
    ``,
    `Agente: ${p.agenteNome}`,
    `Data: ${dataFormatada}`,
    ``,
    `_Documento gerado pelo TCS — Relatório de Risco_`,
  ];

  return linhas.filter(l => l !== null).join('\n');
}
