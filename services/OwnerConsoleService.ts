export const OWNER_CONSOLE_SECTIONS = [
  { key: 'home', title: 'Console completo', path: '/app' },
  { key: 'customers', title: 'Clientes e organizações', path: '/app/clientes' },
  { key: 'plans', title: 'Editar planos e módulos', path: '/app/planos' },
  { key: 'subscriptions', title: 'Assinaturas e contratações', path: '/app/assinaturas' },
  { key: 'billing', title: 'Faturas e financeiro', path: '/app/faturas' },
  { key: 'forms', title: 'Editor de formulários', path: '/app/desenvolvimento/formularios' },
  { key: 'risk', title: 'Regras e simulação de risco', path: '/app/desenvolvimento/regras-risco' },
  { key: 'sessions', title: 'Sessões e acessos', path: '/app/sessoes' },
  { key: 'devices', title: 'Dispositivos', path: '/app/dispositivo' },
  { key: 'communications', title: 'Comunicados', path: '/app/comunicacoes' },
  { key: 'campaigns', title: 'Avisos e campanhas', path: '/app/avisos' },
  { key: 'builds', title: 'Compilações e distribuição', path: '/app/desenvolvimento/builds' },
  { key: 'sync', title: 'Diagnóstico de sincronização', path: '/app/desenvolvimento/sincronizacao' },
  { key: 'storage', title: 'Armazenamento', path: '/app/desenvolvimento/armazenamento' },
  { key: 'support', title: 'Atendimento e respostas', path: '/app/suporte' },
  { key: 'audit', title: 'Auditoria', path: '/app/auditoria' },
] as const;

export function ownerConsoleOrigin(value = process.env.EXPO_PUBLIC_ADMIN_CONSOLE_URL || 'https://tcsvistoria.pages.dev'): string {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || !['', '/'].includes(url.pathname)) {
    throw new Error('O endereço do console deve ser uma origem HTTPS, sem credenciais ou parâmetros.');
  }
  return url.origin;
}

export function buildOwnerConsoleUrl(section: string, origin?: string): string {
  return ownerConsoleOrigin(origin) + (OWNER_CONSOLE_SECTIONS.find(item => item.key === section)?.path ?? '/app');
}

export function classifyOwnerConsoleNavigation(value: string, origin?: string): 'internal' | 'external' | 'blocked' {
  try {
    const trusted = ownerConsoleOrigin(origin);
    if (value === 'about:blank') return 'internal';
    const url = new URL(value);
    if (url.username || url.password) return 'blocked';
    if (url.protocol === 'blob:') return url.origin === trusted ? 'internal' : 'blocked';
    if (url.protocol !== 'https:') return 'blocked';
    if (url.origin === trusted && /^\/app\/(ia|whatsapp)(\/|$)/i.test(url.pathname)) return 'blocked';
    return url.origin === trusted ? 'internal' : 'external';
  } catch { return 'blocked'; }
}
