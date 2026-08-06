import { useQuery } from '@tanstack/react-query';
import { ArrowRight, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { jsonArray, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export interface DashboardMetric {
  key: string;
  label: string;
  value: number;
}

export interface DashboardAttention {
  type: string;
  label: string;
  detail: string | null;
  status: string | null;
  customerId: string | null;
  dueAt: string | null;
}

export interface DashboardData {
  kind: 'executive' | 'technical';
  metrics: DashboardMetric[];
  attention: DashboardAttention[];
  release: { published: string; minimum: string; development: string } | null;
}

function parseDashboard(value: import('@/types/supabase').Json | null): DashboardData {
  const root = jsonObject(value);
  const kind = jsonString(root?.kind) === 'technical' ? 'technical' : 'executive';
  const metrics = jsonArray(root?.metrics)
    .map(jsonObject)
    .filter(Boolean)
    .map((item) => ({
      key: jsonString(item?.key) || 'metric',
      label: jsonString(item?.label) || 'Indicador',
      value: jsonNumber(item?.value) || 0,
    }));
  const attention = jsonArray(root?.attention)
    .map(jsonObject)
    .filter(Boolean)
    .map((item) => ({
      type: jsonString(item?.type) || 'event',
      label: jsonString(item?.label) || 'Evento',
      detail: jsonString(item?.detail),
      status: jsonString(item?.status),
      customerId: jsonString(item?.customer_id),
      dueAt: jsonString(item?.due_at),
    }));
  const rawRelease = jsonObject(root?.release);

  return {
    kind,
    metrics,
    attention,
    release: rawRelease
      ? {
          published: jsonString(rawRelease?.published_version) || '—',
          minimum: jsonString(rawRelease?.minimum_version) || '—',
          development: jsonString(rawRelease?.development_version) || '—',
        }
      : null,
  };
}

async function fetchDashboard(): Promise<DashboardData> {
  const { data, error } = await supabase.rpc('get_internal_dashboard');
  if (error) throw error;
  return parseDashboard(data ?? null);
}

export function DashboardHome() {
  const { profile } = useAuth();
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: fetchDashboard,
  });

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Bom dia' : now.getHours() < 18 ? 'Boa tarde' : 'Boa noite';
  const dateStr = now.toLocaleDateString('pt-BR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
          <p className="text-sm text-muted-foreground">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <div className="text-center max-w-md">
          <AlertTriangle className="mx-auto h-12 w-12 text-destructive mb-4" />
          <h2 className="text-lg font-semibold mb-2">Erro ao carregar dashboard</h2>
          <p className="text-sm text-muted-foreground">
            {error instanceof Error ? error.message : 'Erro desconhecido'}
          </p>
        </div>
      </div>
    );
  }

  const mainMetrics = data?.metrics.slice(0, 3) || [];
  const recentActivities = data?.attention.slice(0, 4) || [];

  return (
    <div className="min-h-screen p-8 lg:p-12 max-w-7xl mx-auto">
      {/* Hero Section */}
      <header className="mb-16 animate-in fade-in duration-500">
        <h1 className="text-6xl font-extrabold tracking-tight mb-3 bg-gradient-to-br from-foreground to-muted-foreground bg-clip-text text-transparent">
          {greeting}, {profile?.displayName?.split(' ')[0] || 'Usuário'}
        </h1>
        <p className="text-lg text-muted-foreground capitalize">
          Console TCS · {dateStr}
        </p>
      </header>

      {/* Stats Grid - Números Monumentais */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-12 mb-16 animate-in fade-in duration-500 delay-100">
        {mainMetrics.map((metric, idx) => (
          <div key={metric.key} className="group">
            <div className={cn(
              "stat-number mb-3 transition-colors",
              idx === 2 && metric.value === 0 ? "text-primary" : "text-foreground"
            )}>
              {metric.key === 'build_status'
                ? (metric.value === 0 ? 'OK' : '!')
                : metric.value.toLocaleString('pt-BR')}
            </div>
            <div className="stat-label">{metric.label}</div>
            {metric.key === 'build_status' && data?.release && (
              <p className="text-xs text-muted-foreground mt-2">
                {data.release.published}
              </p>
            )}
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <section className="mb-16 animate-in fade-in duration-500 delay-200">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
          <h2 className="stat-label">Ações rápidas</h2>
        </div>
        <div className="space-y-1">
          <Link to="/app/clientes" className="action-item group">
            <span className="text-sm font-medium">Ver clientes</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
          <Link to="/app/desenvolvimento/builds" className="action-item group">
            <span className="text-sm font-medium">Builds</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
          <Link to="/app/auditoria" className="action-item group">
            <span className="text-sm font-medium">Auditoria</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
          <Link to="/app/sessoes" className="action-item group">
            <span className="text-sm font-medium">Sessões ativas</span>
            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
          </Link>
        </div>
      </section>

      {/* Activity Timeline */}
      {recentActivities.length > 0 && (
        <section className="animate-in fade-in duration-500 delay-300">
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
            <h2 className="stat-label">Atividade recente</h2>
            <Link
              to="/app/auditoria"
              className="text-xs font-medium text-primary hover:opacity-70 transition-opacity"
            >
              Ver todas →
            </Link>
          </div>
          <div className="space-y-0">
            {recentActivities.map((activity, idx) => (
              <div key={idx} className="timeline-item">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground font-medium mb-1">
                      {activity.label}
                    </p>
                    {activity.detail && (
                      <p className="text-xs text-muted-foreground">
                        {activity.detail}
                      </p>
                    )}
                  </div>
                  {activity.dueAt && (
                    <time className="text-xs text-muted-foreground whitespace-nowrap">
                      {new Date(activity.dueAt).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </time>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
