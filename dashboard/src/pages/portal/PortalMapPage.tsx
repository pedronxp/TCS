import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarDays, Filter, MapPin, RefreshCw, Search, UserRound, X } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { PortalMap, type PortalMapPoint } from '@/components/portal/PortalMap';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace, portalHome } from '@/lib/portal';

function coordinateOrNull(value: unknown, minimum: number, maximum: number) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum ? value : null;
}

export function PortalMapPage() {
  const { access } = usePortalAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = useQuery({
    queryKey: ['portal', 'workspace', 'mapa', access?.userId, access?.accountKind, access?.organizationId, access?.role],
    queryFn: () => fetchPortalWorkspace('mapa'),
    enabled: Boolean(access),
  });
  const root = portalHome(access?.accountKind);
  const search = searchParams.get('busca') ?? '';
  const status = searchParams.get('status') ?? 'all';
  const formulario = searchParams.get('formulario') ?? 'all';
  const risk = searchParams.get('risco') ?? 'all';
  const agent = searchParams.get('usuario') ?? 'all';
  const from = searchParams.get('de') ?? '';
  const to = searchParams.get('ate') ?? '';
  type FilterableMapPoint = PortalMapPoint & { riskLevel: string; agentUserId: string | null; agentName: string; occurredAt: string | null; municipality: string };
  const points: FilterableMapPoint[] = useMemo(() => (query.data?.items ?? []).map((item) => ({
    id: String(item.id),
    protocol: String(item.protocol ?? item.title ?? 'Vistoria'),
    status: String(item.status ?? 'Sem status'),
    address: String(item.address ?? item.subtitle ?? 'Endereço não informado'),
    formularioId: typeof item.formulario_id === 'string' ? item.formulario_id : null,
    riskLevel: String(item.risk_level ?? 'Sem risco'),
    agentUserId: typeof item.agent_user_id === 'string' ? item.agent_user_id : null,
    agentName: String(item.agent_name ?? 'Usuário não identificado'),
    occurredAt: typeof item.occurred_at === 'string' ? item.occurred_at : null,
    municipality: String(item.municipality ?? ''),
    latitude: coordinateOrNull(item.latitude, -90, 90),
    longitude: coordinateOrNull(item.longitude, -180, 180),
  })), [query.data?.items]);
  const statusOptions = useMemo(() => Array.from(new Set(points.map((point) => point.status))).filter(Boolean), [points]);
  const formularioOptions = useMemo(() => Array.from(new Set(points.map((point) => point.formularioId).filter((value): value is string => Boolean(value)))), [points]);
  const riskOptions = useMemo(() => Array.from(new Set(points.map((point) => point.riskLevel))).filter(Boolean), [points]);
  const agentOptions = useMemo(() => Array.from(new Map(points.filter((point) => point.agentUserId).map((point) => [point.agentUserId as string, point.agentName])).entries()), [points]);
  const visiblePoints = points.filter((point) => {
    const term = search.trim().toLocaleLowerCase('pt-BR');
    const matchesSearch = `${point.protocol} ${point.address} ${point.municipality} ${point.agentName}`.toLocaleLowerCase('pt-BR').includes(term);
    const date = point.occurredAt?.slice(0, 10) ?? '';
    return matchesSearch
      && (status === 'all' || point.status === status)
      && (formulario === 'all' || point.formularioId === formulario)
      && (risk === 'all' || point.riskLevel === risk)
      && (agent === 'all' || point.agentUserId === agent)
      && (!from || (date && date >= from))
      && (!to || (date && date <= to));
  });
  const locatedCount = visiblePoints.filter((point) => point.latitude !== null && point.longitude !== null).length;

  function updateFilter(key: 'busca' | 'status' | 'formulario' | 'risco' | 'usuario' | 'de' | 'ate', value: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || (['status', 'formulario', 'risco', 'usuario'].includes(key) && value === 'all')) next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  }

  return (
    <div className="page-stack">
      <header>
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Território</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em]">Mapa de vistorias</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Localize os registros autorizados para seu escopo. A lista abaixo oferece a mesma informação sem depender do mapa.</p>
        </div>
        <div className="mt-5 grid gap-2 rounded-2xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8" aria-label="Filtros do mapa">
          <label className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Buscar vistoria ou endereço</span>
            <Input className="pl-9" placeholder="Buscar vistoria ou endereço" value={search} onChange={(event) => updateFilter('busca', event.target.value)} />
          </label>
          <label className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Filtrar mapa por formulário</span>
            <select className="h-11 min-w-44 rounded-md border border-border bg-card pl-9 pr-8 text-sm" value={formulario} onChange={(event) => updateFilter('formulario', event.target.value)}>
              <option value="all">Todos os formulários</option>
              {formularioOptions.map((option) => <option key={option} value={option}>{formularioLabel(option)}</option>)}
            </select>
          </label>
          <label className="relative">
            <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <span className="sr-only">Filtrar mapa por status</span>
            <select className="h-11 min-w-44 rounded-md border border-border bg-card pl-9 pr-8 text-sm" value={status} onChange={(event) => updateFilter('status', event.target.value)}>
              <option value="all">Todos os status</option>
              {statusOptions.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}
            </select>
          </label>
          <label className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Filtrar mapa por risco</span><select className="h-11 w-full rounded-md border bg-card pl-9 pr-8 text-sm" value={risk} onChange={(event) => updateFilter('risco', event.target.value)}><option value="all">Todos os riscos</option>{riskOptions.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}</select></label>
          <label className="relative"><UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Filtrar mapa por usuário</span><select className="h-11 w-full rounded-md border bg-card pl-9 pr-8 text-sm" value={agent} onChange={(event) => updateFilter('usuario', event.target.value)}><option value="all">Todos os usuários</option>{agentOptions.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
          <label className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Data inicial</span><Input type="date" className="pl-9" value={from} onChange={(event) => updateFilter('de', event.target.value)} /></label>
          <label className="relative"><CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Data final</span><Input type="date" className="pl-9" value={to} onChange={(event) => updateFilter('ate', event.target.value)} /></label>
          <Button type="button" variant="ghost" className="min-h-11" disabled={!location.search} onClick={() => setSearchParams({}, { replace: true })}><X />Limpar</Button>
        </div>
      </header>

      {query.isLoading ? (
        <div role="status" aria-label="Carregando mapa" className="space-y-4"><span className="sr-only">Carregando mapa…</span><Skeleton className="h-[520px] rounded-lg motion-reduce:animate-none" /></div>
      ) : query.isError ? (
        <Card>
          <CardContent className="grid min-h-72 place-items-center p-8 text-center" role="alert">
            <div>
              <p className="font-semibold">Não foi possível carregar as vistorias do mapa</p>
              <p className="mt-2 text-sm text-muted-foreground">Nenhum ponto foi estimado ou exibido fora do seu escopo.</p>
              <Button className="mt-4" variant="outline" onClick={() => void query.refetch()}><RefreshCw aria-hidden="true" />Tentar novamente</Button>
            </div>
          </CardContent>
        </Card>
      ) : visiblePoints.length === 0 ? (
        <Card><CardContent className="grid min-h-72 place-items-center p-8 text-center"><div><MapPin className="mx-auto h-8 w-8 text-primary" aria-hidden="true" /><h2 className="mt-4 font-semibold">{points.length === 0 ? 'Nenhuma vistoria no mapa' : 'Nenhum ponto corresponde aos filtros'}</h2><p className="mt-2 text-sm text-muted-foreground">{points.length === 0 ? 'Quando houver registros no seu escopo, eles aparecerão aqui.' : 'Ajuste a busca ou o status para ampliar o resultado.'}</p></div></CardContent></Card>
      ) : (
        <>
          <p className="text-sm text-muted-foreground" role="status">{locatedCount} de {visiblePoints.length} {visiblePoints.length === 1 ? 'vistoria possui' : 'vistorias possuem'} coordenadas disponíveis.</p>
          <PortalMap points={visiblePoints} />
        </>
      )}

      {!query.isLoading && !query.isError && visiblePoints.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Lista das vistorias exibidas</CardTitle></CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {visiblePoints.map((point) => (
                <li key={point.id} className="grid gap-3 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                  <div><p className="font-semibold">{point.protocol}</p><p className="mt-1 leading-5 text-muted-foreground">{humanize(point.status)} · {humanize(point.riskLevel)} · {point.agentName}</p><p className="mt-1 text-xs text-muted-foreground">{point.address}{point.occurredAt ? ` · ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(new Date(point.occurredAt))}` : ''}{point.latitude !== null && point.longitude !== null ? ` · ${point.latitude.toFixed(5)}, ${point.longitude.toFixed(5)}` : ' · Sem coordenadas'}</p></div>
                  <Button asChild variant="ghost" size="sm" className="min-h-11"><Link to={`${root}/vistorias/${encodeURIComponent(point.id)}?returnTo=${encodeURIComponent(`${location.pathname}${location.search}`)}`}>Ver vistoria</Link></Button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function humanize(value: string) {
  const normalized = value.replace(/_/g, ' ');
  return normalized.charAt(0).toLocaleUpperCase('pt-BR') + normalized.slice(1);
}

function formularioLabel(value: string) {
  return ({
    inspecao_bueiro_drenagem_v1: 'Bueiro e drenagem',
    risco_incendio_vegetacao_v1: 'Incêndio em vegetação',
    risco_inundacao_v1: 'Alagamento e inundação',
    avaliacao_arvore_cbmmg_v1: 'Vistoria de árvores',
  } as Record<string, string>)[value] ?? humanize(value);
}
