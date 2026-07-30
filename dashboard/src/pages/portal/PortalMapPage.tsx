import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { PortalMap, type PortalMapPoint } from '@/components/portal/PortalMap';
import { fetchPortalWorkspace } from '@/lib/portal';

function numberOrNull(value: unknown) {
  return typeof value === 'number' ? value : null;
}

export function PortalMapPage() {
  const query = useQuery({ queryKey: ['portal', 'workspace', 'mapa'], queryFn: () => fetchPortalWorkspace('mapa') });
  const points: PortalMapPoint[] = (query.data?.items ?? []).map((item) => ({
    id: String(item.id),
    protocol: String(item.protocol ?? item.title ?? 'Vistoria'),
    status: String(item.status ?? 'Sem status'),
    address: String(item.subtitle ?? 'Endereço não informado'),
    latitude: numberOrNull(item.latitude),
    longitude: numberOrNull(item.longitude),
  }));
  return (
    <div className="page-stack">
      <header><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Território</p><h1 className="mt-2 text-3xl font-semibold">Mapa</h1><p className="mt-2 text-sm text-muted-foreground">Somente pontos autorizados pelo seu escopo server-side.</p></header>
      {query.isLoading ? (
        <div className="h-[520px] animate-pulse rounded-lg bg-secondary" />
      ) : query.isError ? (
        <Card>
          <CardContent className="grid min-h-64 place-items-center p-8 text-center">
            <div>
              <p className="font-semibold">Não foi possível carregar o mapa.</p>
              <button className="mt-4 min-h-11 rounded-md border px-4 text-sm font-semibold" onClick={() => void query.refetch()}>
                Tentar novamente
              </button>
            </div>
          </CardContent>
        </Card>
      ) : <PortalMap points={points} />}
      <Card><CardHeader><CardTitle>Alternativa textual do mapa</CardTitle></CardHeader><CardContent><ul className="divide-y">{points.map((point) => <li key={point.id} className="py-3 text-sm"><p className="font-semibold">{point.protocol}</p><p className="mt-1 text-muted-foreground">{point.status} · {point.address}{point.latitude !== null ? ` · ${point.latitude.toFixed(5)}, ${point.longitude?.toFixed(5)}` : ''}</p></li>)}</ul>{points.length === 0 && <p className="text-sm text-muted-foreground">Nenhum ponto disponível.</p>}</CardContent></Card>
    </div>
  );
}
