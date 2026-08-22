import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Building2, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { fetchOrgsComunicadosConsole } from '@/lib/comunicados';

// Lista de prefeituras: o clique abre o espaço de operação da prefeitura
// (/app/comunicacoes/:orgId) com entregas, programados, números e comunidades.
export function ConsoleComunicadosPage() {
  const navigate = useNavigate();
  const orgsQuery = useQuery({
    queryKey: ['console', 'comunicados', 'orgs'],
    queryFn: fetchOrgsComunicadosConsole,
  });
  const orgs = orgsQuery.data ?? [];

  return (
    <div className="page-stack">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Operação TCS</p>
        <h1 className="mt-2 text-3xl font-semibold">Comunicados e comunidades</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Escolha a prefeitura para operar números do bot, comunidades, disparos e acompanhar entregas.
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Building2 /> Prefeituras</CardTitle>
        </CardHeader>
        <CardContent>
          {orgsQuery.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {orgsQuery.isError && (
            <div className="space-y-3 text-sm text-destructive" role="alert">
              <p>Não foi possível carregar as prefeituras.</p>
              <Button variant="outline" size="sm" onClick={() => void orgsQuery.refetch()}>Tentar novamente</Button>
            </div>
          )}
          {!orgsQuery.isLoading && orgs.length === 0 && (
            <p className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma organização encontrada.
            </p>
          )}
          <ul className="divide-y">
            {orgs.map((item) => (
              <li key={item.organizationId}>
                <button
                  type="button"
                  className="flex w-full min-w-0 items-center justify-between gap-3 py-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  aria-label={`Abrir operação de ${item.organizationName}`}
                  onClick={() => navigate(`/app/comunicacoes/${item.organizationId}`)}
                >
                  <span className="min-w-0">
                    <span className="block break-words text-sm font-semibold">{item.organizationName}</span>
                    <span className="mt-1 block text-xs text-muted-foreground">
                      {item.municipality ?? '—'} · {item.numerosVinculados} nº vinculado{item.numerosVinculados === 1 ? '' : 's'}
                      {' · '}{item.comunidadesAtivas} comunidade{item.comunidadesAtivas === 1 ? '' : 's'}
                      {' · '}{item.comunicadosPublicados} publicado{item.comunicadosPublicados === 1 ? '' : 's'}
                      {item.enviosPendentes > 0 ? ` · ${item.enviosPendentes} na fila` : ''}
                      {item.enviosFalhas > 0 ? ` · ${item.enviosFalhas} falha${item.enviosFalhas === 1 ? '' : 's'}` : ''}
                    </span>
                  </span>
                  <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
