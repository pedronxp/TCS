import { useDeferredValue, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, AlertTriangle, ArrowRight, Laptop, RefreshCw, ShieldCheck, Smartphone, Tablet } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { PageHeader } from '@/components/domain/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/Table';
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabase';

type DeviceRow = {
  deviceKey: string;
  deviceName: string;
  platform: string;
  active: boolean;
  attention: boolean;
  latestStatus: string;
  lastSeenAt: string;
  firstSeenAt: string;
  sessionCount: number;
  activeSessions: number;
  userCount: number;
  organizationCount: number;
  organizationName: string | null;
};

type DeviceWorkspace = {
  items: DeviceRow[];
  summary: { total: number; active: number; attention: number; platforms: Record<string, number> };
  generatedAt: string | null;
};

export function DevicesPage() {
  const [state, setState] = useState<'all' | 'active' | 'inactive'>('active');
  const [platform, setPlatform] = useState('all');
  const [search, setSearch] = useState('');
  const deferredSearch = useDeferredValue(search);
  const query = useQuery({
    queryKey: ['internal-devices', state, platform, deferredSearch],
    queryFn: () => loadDevices(state, platform, deferredSearch),
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
  });
  const summary = query.data?.summary;
  const mobileDevices = useMemo(() => (summary?.platforms.android ?? 0) + (summary?.platforms.ios ?? 0), [summary]);

  return (
    <div className="page-stack space-y-6">
      <PageHeader
        eyebrow="Segurança e acessos"
        title="Dispositivos"
        description="Inventário dinâmico de aparelhos que registraram acesso. IPs, MACs e identificadores brutos não são exibidos neste painel."
        actions={<><Button asChild variant="outline"><Link to="/app/sessoes">Ver sessões<ArrowRight aria-hidden="true" /></Link></Button><Button variant="outline" onClick={() => void query.refetch()} disabled={query.isFetching}><RefreshCw className={cn(query.isFetching && 'animate-spin motion-reduce:animate-none')} />{query.isFetching ? 'Atualizando…' : 'Atualizar'}</Button></>}
      />

      <AsyncBoundary loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} loadingLabel="Carregando inventário de dispositivos…">
        {query.data && summary && <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo de dispositivos">
            <DeviceMetric label="Dispositivos registrados" value={summary.total} icon={Laptop} />
            <DeviceMetric label="Ativos agora" value={summary.active} icon={Activity} tone="success" />
            <DeviceMetric label="Precisam de sinal" value={summary.attention} icon={AlertTriangle} tone={summary.attention > 0 ? 'warning' : 'default'} />
            <DeviceMetric label="Celulares e tablets" value={mobileDevices} icon={Smartphone} tone="info" />
          </section>

          <Card className="overflow-hidden shadow-none">
            <div className="flex flex-col gap-4 border-b bg-muted/30 p-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-base font-bold">Inventário de dispositivos</h2>
                <p className="mt-1 text-xs text-muted-foreground">Atualização automática a cada 30 segundos enquanto esta tela estiver aberta.</p>
              </div>
              <div className="grid gap-2 sm:grid-cols-3 lg:w-[680px]">
                <Select value={state} onValueChange={(value) => setState(value as typeof state)}><SelectTrigger aria-label="Filtrar estado"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Ativos</SelectItem><SelectItem value="inactive">Inativos</SelectItem><SelectItem value="all">Todos os estados</SelectItem></SelectContent></Select>
                <Select value={platform} onValueChange={setPlatform}><SelectTrigger aria-label="Filtrar plataforma"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todas plataformas</SelectItem><SelectItem value="web">Web</SelectItem><SelectItem value="android">Android</SelectItem><SelectItem value="ios">iOS</SelectItem><SelectItem value="unknown">Não identificada</SelectItem></SelectContent></Select>
                <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Nome ou organização" aria-label="Pesquisar dispositivos" />
              </div>
            </div>
            {query.data.items.length ? <><div className="overflow-x-auto"><Table className="min-w-[930px]"><TableHeader><TableRow className="bg-muted/40 hover:bg-muted/40"><TableHead className="pl-6">Dispositivo</TableHead><TableHead>Organização</TableHead><TableHead>Uso</TableHead><TableHead>Último sinal</TableHead><TableHead>Estado</TableHead><TableHead className="pr-6 text-right">Ação</TableHead></TableRow></TableHeader><TableBody>{query.data.items.map((device) => <TableRow key={device.deviceKey} className="hover:bg-muted/40"><TableCell className="pl-6"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><PlatformIcon platform={device.platform} /></span><div><p className="font-semibold">{device.deviceName}</p><p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">{platformLabel(device.platform)} · {device.userCount} {device.userCount === 1 ? 'conta' : 'contas'}</p></div></div></TableCell><TableCell><p className="text-sm font-medium">{device.organizationName || 'Sem organização vinculada'}</p><p className="mt-1 text-xs text-muted-foreground">{device.organizationCount} {device.organizationCount === 1 ? 'organização' : 'organizações'} no histórico</p></TableCell><TableCell><p className="text-sm font-semibold tabular-nums">{device.activeSessions} ativa(s)</p><p className="mt-1 text-xs text-muted-foreground">{device.sessionCount} sessão(ões) registradas</p></TableCell><TableCell><p className="text-sm font-medium">{relativeActivity(device.lastSeenAt)}</p><p className="mt-1 text-xs text-muted-foreground">Primeiro registro: {formatDate(device.firstSeenAt)}</p></TableCell><TableCell><DeviceStatus device={device} /></TableCell><TableCell className="pr-6 text-right"><Button asChild variant="outline" size="sm"><Link to={`/app/sessoes?busca=${encodeURIComponent(device.deviceName)}`}>Ver sessões<ArrowRight aria-hidden="true" /></Link></Button></TableCell></TableRow>)}</TableBody></Table></div><div className="flex flex-wrap items-center justify-between gap-2 border-t bg-muted/20 px-6 py-3 text-xs text-muted-foreground"><span>{query.data.items.length} dispositivo(s) exibido(s).</span><span>Consultado em {formatDateTime(query.data.generatedAt)}.</span></div></> : <div className="grid min-h-56 place-items-center p-8 text-center"><div><ShieldCheck className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden="true" /><h3 className="mt-4 font-semibold">Nenhum dispositivo encontrado</h3><p className="mt-1 text-sm text-muted-foreground">Ajuste os filtros ou aguarde um novo acesso registrado.</p></div></div>}
          </Card>
        </>}
      </AsyncBoundary>
    </div>
  );
}

function DeviceMetric({ label, value, icon: Icon, tone = 'default' }: { label: string; value: number; icon: typeof Laptop; tone?: 'default' | 'success' | 'warning' | 'info' }) {
  const iconClass = tone === 'success' ? 'bg-success-soft text-success' : tone === 'warning' ? 'bg-warning-soft text-warning' : tone === 'info' ? 'bg-info-soft text-info' : 'bg-primary/10 text-primary';
  return <Card className="shadow-none"><CardContent className="flex items-center gap-3 p-5"><span className={cn('grid h-10 w-10 place-items-center rounded-xl', iconClass)}><Icon className="h-5 w-5" /></span><div><p className="text-xs font-medium text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString('pt-BR')}</p></div></CardContent></Card>;
}

function DeviceStatus({ device }: { device: DeviceRow }) {
  if (device.attention) return <div><Badge variant="warning">Sem sinal há 30 min</Badge><p className="mt-1 text-[11px] text-warning">Revisar sessão ativa</p></div>;
  if (device.active) return <div><Badge variant="success">Ativo</Badge><p className="mt-1 text-[11px] text-muted-foreground">Sinal recente</p></div>;
  return <Badge variant="secondary">Inativo</Badge>;
}

function PlatformIcon({ platform }: { platform: string }) {
  if (platform === 'web') return <Laptop className="h-4 w-4" />;
  if (platform === 'ios') return <Tablet className="h-4 w-4" />;
  return <Smartphone className="h-4 w-4" />;
}

function platformLabel(platform: string) {
  if (platform === 'ios') return 'iOS';
  if (platform === 'web') return 'Web';
  if (platform === 'android') return 'Android';
  return 'Não identificada';
}

function relativeActivity(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem sinal';
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return 'Agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 24 * 60) return `há ${Math.floor(minutes / 60)} h`;
  return formatDate(value);
}

function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Não informado' : new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
}

function formatDateTime(value: string | null) {
  if (!value) return 'agora';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'agora' : date.toLocaleString('pt-BR');
}

async function loadDevices(state: string, platform: string, search: string): Promise<DeviceWorkspace> {
  const { data, error } = await (supabase.rpc as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>)('get_internal_device_workspace', {
    p_state: state === 'all' ? null : state,
    p_platform: platform === 'all' ? null : platform,
    p_search: search.trim() || null,
    p_limit: 200,
  });
  if (error) throw error;
  if (!data || typeof data !== 'object') throw new Error('device_workspace_invalid');
  const root = data as Record<string, unknown>;
  const summary = (root.summary && typeof root.summary === 'object' ? root.summary : {}) as Record<string, unknown>;
  const platforms = (summary.platforms && typeof summary.platforms === 'object' ? summary.platforms : {}) as Record<string, unknown>;
  const count = (value: unknown) => typeof value === 'number' ? value : 0;
  const items = Array.isArray(root.items) ? root.items.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object').map((item) => ({
    deviceKey: typeof item.device_key === 'string' ? item.device_key : crypto.randomUUID(),
    deviceName: typeof item.device_name === 'string' ? item.device_name : 'Dispositivo não identificado',
    platform: typeof item.platform === 'string' ? item.platform : 'unknown',
    active: item.active === true,
    attention: item.attention === true,
    latestStatus: typeof item.latest_status === 'string' ? item.latest_status : 'unknown',
    lastSeenAt: typeof item.last_seen_at === 'string' ? item.last_seen_at : '',
    firstSeenAt: typeof item.first_seen_at === 'string' ? item.first_seen_at : '',
    sessionCount: count(item.session_count), activeSessions: count(item.active_sessions), userCount: count(item.user_count), organizationCount: count(item.organization_count),
    organizationName: typeof item.organization_name === 'string' ? item.organization_name : null,
  })) : [];
  return { items, summary: { total: count(summary.total), active: count(summary.active), attention: count(summary.attention), platforms: Object.fromEntries(Object.entries(platforms).map(([key, value]) => [key, count(value)])) }, generatedAt: typeof root.generated_at === 'string' ? root.generated_at : null };
}
