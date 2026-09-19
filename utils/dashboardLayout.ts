import { supabase } from './supabase';

// ─── Templates de dashboard (F5) ─────────────────────────────────────────────
// Layout = [{widget, visivel, ordem}] por (organização, papel), com fallback
// para template global e, por fim, para o DEFAULT_LAYOUT abaixo.

export const DASHBOARD_ROLES = ['agent', 'supervisor', 'admin'] as const;
export type DashboardRole = (typeof DASHBOARD_ROLES)[number];

export interface WidgetDef {
  id: string;
  nome: string;
  descricao: string;
  roles: DashboardRole[];      // em quais papéis o widget faz sentido
}

export const WIDGETS: WidgetDef[] = [
  { id: 'metricas_turno', nome: 'Métricas do turno', descricao: 'Vistorias hoje, atenção e total', roles: ['agent', 'supervisor', 'admin'] },
  { id: 'alertas_risco', nome: 'Alertas de risco', descricao: 'Últimas vistorias R3/R4 da operação', roles: ['supervisor', 'admin'] },
  { id: 'qe_pendencias', nome: 'Qualidade (QE)', descricao: 'Quantas vistorias aguardam revisão', roles: ['supervisor', 'admin'] },
  { id: 'acao_principal', nome: 'Ação principal', descricao: 'Painel "Nova vistoria"', roles: ['agent', 'supervisor', 'admin'] },
  { id: 'acesso_rapido', nome: 'Acesso rápido', descricao: 'Grade de módulos frequentes', roles: ['agent', 'supervisor', 'admin'] },
];

export interface LayoutItem { widget: string; visivel: boolean; ordem: number; }

export const DEFAULT_LAYOUT: LayoutItem[] = [
  { widget: 'metricas_turno', visivel: true, ordem: 1 },
  { widget: 'alertas_risco', visivel: true, ordem: 2 },
  { widget: 'acao_principal', visivel: true, ordem: 3 },
  { widget: 'qe_pendencias', visivel: true, ordem: 4 },
  { widget: 'acesso_rapido', visivel: true, ordem: 5 },
];

const widgetIds = new Set(WIDGETS.map(w => w.id));

/** Normaliza o layout vindo do banco: ignora widgets desconhecidos, completa os que faltam */
export function normalizarLayout(layout: unknown): LayoutItem[] {
  const recebido = Array.isArray(layout) ? (layout as any[]) : [];
  const itens = recebido
    .filter(i => i && typeof i.widget === 'string' && widgetIds.has(i.widget))
    .map(i => ({ widget: i.widget as string, visivel: i.visivel !== false, ordem: Number(i.ordem) || 999 }));

  for (const padrao of DEFAULT_LAYOUT) {
    if (!itens.some(i => i.widget === padrao.widget)) {
      itens.push({ ...padrao, visivel: false });   // widget novo não existia no template salvo → vem desligado
    }
  }
  return itens.sort((a, b) => a.ordem - b.ordem);
}

export async function buscarLayoutDashboard(role: DashboardRole = 'agent'): Promise<LayoutItem[]> {
  try {
    const { data, error } = await supabase.rpc('get_dashboard_layout', { p_role: role });
    if (error) return DEFAULT_LAYOUT;
    return normalizarLayout(data);
  } catch {
    return DEFAULT_LAYOUT;
  }
}

export async function salvarLayoutDashboard(role: DashboardRole, layout: LayoutItem[]): Promise<void> {
  const { error } = await supabase.rpc('save_dashboard_layout', { p_role: role, p_layout: layout });
  if (error) throw error;
}
