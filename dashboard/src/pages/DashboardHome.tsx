import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, Building2, CreditCard, Headphones, Smartphone, Wrench, type LucideIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { ErrorState, LoadingState, StatusBadge } from '@/components/ui/AsyncState';
import { useAuth } from '@/contexts/AuthContext';
import { jsonArray, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { supabase } from '@/lib/supabase';

interface Metric { key: string; label: string; value: number }
interface Attention { type: string; label: string; detail: string | null; status: string | null; customerId: string | null; dueAt: string | null }
interface Dashboard { kind: 'executive' | 'technical'; metrics: Metric[]; attention: Attention[]; release: { published: string; minimum: string; development: string } | null }

const icons: Record<string, LucideIcon> = { customers: Building2, subscriptions: CreditCard, renewals: Activity, past_due: AlertTriangle, support: Headphones, sla: AlertTriangle, onboarding: Building2, builds_running: Wrench, builds_failed: AlertTriangle, sync: Smartphone, storage: CreditCard, errors: AlertTriangle };

function parseDashboard(value: import('@/types/supabase').Json | null): Dashboard {
  const root = jsonObject(value); const kind = jsonString(root?.kind) === 'technical' ? 'technical' : 'executive';
  const metrics = jsonArray(root?.metrics).map(jsonObject).filter(Boolean).map((item) => ({ key: jsonString(item?.key) || 'metric', label: jsonString(item?.label) || 'Indicador', value: jsonNumber(item?.value) || 0 }));
  const attention = jsonArray(root?.attention).map(jsonObject).filter(Boolean).map((item) => ({ type: jsonString(item?.type) || 'event', label: jsonString(item?.label) || 'Evento', detail: jsonString(item?.detail), status: jsonString(item?.status), customerId: jsonString(item?.customer_id), dueAt: jsonString(item?.due_at) }));
  const rawRelease = jsonObject(root?.release);
  return { kind, metrics, attention, release: rawRelease ? { published: jsonString(rawRelease.published_version) || '—', minimum: jsonString(rawRelease.minimum_version) || '—', development: jsonString(rawRelease.development_version) || '—' } : null };
}

export function DashboardHome() {
  const { profile } = useAuth();
  const query = useQuery({ queryKey: ['internal-dashboard', profile?.role], queryFn: async () => { const { data, error } = await supabase.rpc('get_internal_dashboard'); if (error) throw error; return parseDashboard(data); } });
  if (query.isLoading) return <LoadingState label="Carregando indicadores…" />;
  if (query.isError || !query.data) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  const technical = query.data.kind === 'technical';
  return <section><div className="mb-6"><p className="text-sm font-semibold text-blue-700">Olá, {profile?.displayName}</p><h2 className="mt-1 text-3xl font-bold tracking-tight text-slate-950">{technical ? 'Saúde técnica da plataforma' : 'Visão executiva do negócio'}</h2><p className="mt-2 text-sm text-slate-500">Indicadores persistidos, prioridades e atalhos para agir.</p></div>
    {query.data.release && <div className="mb-5 grid gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 sm:grid-cols-3"><Release label="Publicada" value={query.data.release.published} /><Release label="Mínima" value={query.data.release.minimum} /><Release label="Em desenvolvimento" value={query.data.release.development} /></div>}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{query.data.metrics.map((metric) => { const Icon = icons[metric.key] || Activity; return <article key={metric.key} className="rounded-2xl border bg-white p-5 shadow-sm"><div className="flex items-center justify-between"><p className="text-sm font-medium text-slate-500">{metric.label}</p><Icon className="h-5 w-5 text-blue-600" /></div><p className="mt-4 text-3xl font-bold text-slate-950">{metric.value}</p></article>; })}</div>
    <div className="mt-6 rounded-2xl border bg-white"><div className="border-b p-5"><h3 className="font-bold">Requer atenção</h3><p className="text-sm text-slate-500">{technical ? 'Falhas recentes por severidade.' : 'Renovações, SLA e escalonamentos.'}</p></div>{query.data.attention.length ? <div className="divide-y">{query.data.attention.map((item, index) => <article key={`${item.type}-${item.label}-${index}`} className="flex flex-wrap items-center gap-3 p-4"><div className="min-w-0 flex-1"><p className="truncate font-semibold">{item.label}</p><p className="truncate text-xs text-slate-500">{item.detail || item.type}{item.dueAt ? ` · ${new Date(item.dueAt).toLocaleString('pt-BR')}` : ''}</p></div><StatusBadge value={item.status} />{item.customerId && <Link to={`/clientes/${encodeURIComponent(item.customerId)}`} className="rounded-lg border px-3 py-1.5 text-xs font-semibold text-blue-700">Abrir cliente</Link>}</article>)}</div> : <p className="p-6 text-sm text-slate-500">Nenhuma pendência crítica no momento.</p>}</div>
  </section>;
}
function Release({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-semibold uppercase text-blue-600">{label}</p><p className="mt-1 text-lg font-bold text-blue-950">{value}</p></div>; }
