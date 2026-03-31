/**
 * utils/htmlUtils.ts
 * Funções utilitárias de formatação HTML e de datas.
 * Consolidado de múltiplos arquivos que tinham cópias inline.
 */

/**
 * Escapa caracteres especiais HTML para uso seguro em templates de PDF.
 * Aceita qualquer tipo — converte para string antes de escapar.
 */
export function escapeHtml(str: unknown): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Formata uma string ISO de data para exibição brasileira — apenas data.
 * Ex: "2026-03-28T10:30:00Z" → "28/03/2026"
 */
export function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formata uma string ISO de data para exibição brasileira — data e hora.
 * Ex: "2026-03-28T10:30:00Z" → "28/03/2026 10:30"
 */
export function formatarDataHora(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Retorna tempo relativo em português a partir de uma string ISO.
 * Ex: "há 5 minutos", "há 2 horas", "há 3 dias"
 */
export function tempoRelativo(iso: string | null | undefined): string {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `há ${d} dia${d !== 1 ? 's' : ''}`;
  const w = Math.floor(d / 7);
  if (w < 4) return `há ${w} semana${w !== 1 ? 's' : ''}`;
  return new Date(iso).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}
