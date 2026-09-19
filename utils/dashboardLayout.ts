import { supabase } from './supabase';

// ─── Templates de dashboard (F5/F5b) ─────────────────────────────────────────
// Layout = [{widget, visivel, ordem}] por (organização, papel), com fallback
// para template global e, por fim, para o padrão abaixo.
// Cada papel tem um conjunto próprio de widgets e um layout padrão.

export const DASHBOARD_ROLES = ['agent', 'supervisor', 'admin'] as const;
export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export interface WidgetDef {
  id: string;
  nome: string;
  descricao: string;
}

export const WIDGET_SETS: Record<DashboardRole, WidgetDef[]> = {
  agent: [
    { id: 'metricas_turno', nome: 'Métricas do turno', descricao: 'Vistorias hoje, atenção e total' },
    { id: 'alertas_risco', nome: 'Alertas de risco', descricao: 'Últimas vistorias R3/R4' },
    { id: 'acao_principal', nome: 'Ação principal', descricao: 'Painel "Nova vistoria"' },
    { id: 'qe_pendencias', nome: 'Qualidade (QE)', descricao: 'Vistorias aguardando revisão (visor/supervisor)' },
    { id: 'acesso_rapido', nome: 'Acesso rápido', descricao: 'Grade de módulos frequentes' },
  ],
  supervisor: [
    { id: 'kpis_gerais', nome: 'Visão geral', descricao: 'Vistorias, alertas críticos e agentes ativos' },
    { id: 'ranking_equipe', nome: 'Desempenho da equipe', descricao: 'Ranking mensal de agentes' },
    { id: 'atividade_recente', nome: 'Registro de operações', descricao: 'Últimas vistorias da equipe' },
  ],
  admin: [
    { id: 'kpis_gerais', nome: 'Visão geral', descricao: 'Vistorias, risco e equipe do município' },
    { id: 'ranking_equipe', nome: 'Desempenho da equipe', descricao: 'Ranking mensal de agentes' },
    { id: 'atividade_recente', nome: 'Atividade recente', descricao: 'Últimas vistorias do município' },
  ],
};

export interface LayoutItem { widget: string; visivel: boolean; ordem: number; }

export const DEFAULT_LAYOUTS: Record<DashboardRole, LayoutItem[]> = {
  agent: [
    { widget: 'metricas_turno', visivel: true, ordem: 1 },
    { widget: 'alertas_risco', visivel: true, ordem: 2 },
    { widget: 'acao_principal', visivel: true, ordem: 3 },
    { widget: 'qe_pendencias', visivel: true, ordem: 4 },
    { widget: 'acesso_rapido', visivel: true, ordem: 5 },
  ],
  supervisor: [
    { widget: 'kpis_gerais', visivel: true, ordem: 1 },
    { widget: 'ranking_equipe', visivel: true, ordem: 2 },
    { widget: 'atividade_recente', visivel: true, ordem: 3 },
  ],
  admin: [
    { widget: 'kpis_gerais', visivel: true, ordem: 1 },
    { widget: 'ranking_equipe', visivel: true, ordem: 2 },
    { widget: 'atividade_recente', visivel: true, ordem: 3 },
  ],
};

/** Conjunto de ids válidos para o papel */
const idsPorPapel = (role: DashboardRole) => new Set(WIDGET_SETS[role].map(w => w.id));

/** Normaliza o layout vindo do banco: ignora widgets desconhecidos, completa os que faltam (desligados) */
export function normalizarLayout(layout: unknown, role: DashboardRole = 'agent'): LayoutItem[] {
  const validos = idsPorPapel(role);
  const recebido = Array.isArray(layout) ? (layout as any[]) : [];
  const itens = recebido
    .filter(i => i && typeof i.widget === 'string' && validos.has(i.widget))
    .map(i => ({ widget: i.widget as string, visivel: i.visivel !== false, ordem: Number(i.ordem) || 999 }));

  for (const padrao of DEFAULT_LAYOUTS[role]) {
    if (!itens.some(i => i.widget === padrao.widget)) {
      itens.push({ ...padrao, visivel: false });   // widget novo não existia no template salvo → vem desligado
    }
  }
  return itens.sort((a, b) => a.ordem - b.ordem);
}

export async function buscarLayoutDashboard(role: DashboardRole = 'agent'): Promise<LayoutItem[]> {
  try {
    const { data, error } = await supabase.rpc('get_dashboard_layout', { p_role: role });
    if (error) return DEFAULT_LAYOUTS[role];
    return normalizarLayout(data, role);
  } catch {
    return DEFAULT_LAYOUTS[role];
  }
}

export async function salvarLayoutDashboard(role: DashboardRole, layout: LayoutItem[]): Promise<void> {
  const { error } = await supabase.rpc('save_dashboard_layout', { p_role: role, p_layout: layout });
  if (error) throw error;
}
