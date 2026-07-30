import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, Filter, LockKeyhole, Plus, RefreshCw, Search } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace, portalHome } from '@/lib/portal';
import { Link } from 'react-router-dom';

const moduleCopy: Record<string, { title: string; description: string; action?: string }> = {
  vistorias: { title: 'Vistorias', description: 'Registros técnicos disponíveis no seu escopo operacional.', action: 'Agendar vistoria' },
  mapa: { title: 'Mapa', description: 'Distribuição territorial com alternativa textual dos pontos visíveis.' },
  agenda: { title: 'Agenda', description: 'Compromissos e vínculos com as vistorias da operação.', action: 'Novo agendamento' },
  documentos: { title: 'Documentos', description: 'Laudos e arquivos com acesso temporário e auditável.' },
  relatorios: { title: 'Relatórios', description: 'Indicadores liberados pelo plano e pelo seu papel.' },
  equipe: { title: 'Equipe', description: 'Pessoas e papéis que compõem a operação municipal.' },
  convites: { title: 'Convites', description: 'Acompanhe convites pendentes, aceitos, expirados ou revogados.', action: 'Convidar pessoa' },
  consumo: { title: 'Consumo', description: 'Uso atual comparado aos limites da versão contratada.' },
  assinatura: { title: 'Assinatura', description: 'Plano, ciclo financeiro e ações de cobrança disponíveis.' },
  suporte: { title: 'Suporte', description: 'Solicitações próprias ou da organização conforme seu escopo.', action: 'Abrir chamado' },
  configuracoes: { title: 'Configurações', description: 'Preferências da operação municipal com alterações auditáveis.' },
  perfil: { title: 'Perfil e segurança', description: 'Seus dados, sessões e opções de segurança da conta.' },
};

export function PortalModulePage({ section }: { section: string }) {
  const { access } = usePortalAuth();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const copy = moduleCopy[section] ?? { title: section, description: 'Módulo do portal.' };
  const query = useQuery({
    queryKey: ['portal', 'workspace', section, access?.organizationId, access?.userId],
    queryFn: () => fetchPortalWorkspace(section),
  });
  const locked = section === 'relatorios' && access?.features.reports !== true;
  const root = portalHome(access?.accountKind ?? 'individual');
  const visibleItems = (query.data?.items ?? []).filter((item) => {
    const haystack = `${item.title ?? ''} ${item.name ?? ''} ${item.protocol ?? ''} ${item.subtitle ?? ''}`.toLocaleLowerCase('pt-BR');
    const matchesSearch = haystack.includes(search.trim().toLocaleLowerCase('pt-BR'));
    const matchesStatus = status === 'all' || String(item.status ?? '') === status;
    return matchesSearch && matchesStatus;
  });

  function exportVisibleItems() {
    const rows: Array<Record<string, unknown>> = visibleItems.length > 0
      ? visibleItems
      : Object.entries(query.data?.summary ?? {}).map(([key, value]) => ({ indicador: key, valor: value }));
    if (rows.length === 0) return;
    const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
    const quote = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const csv = [columns.map(quote).join(';'), ...rows.map((row) => columns.map((column) => quote(row[column])).join(';'))].join('\n');
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `tcs-${section}-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="page-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Portal</p><h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em]">{copy.title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{copy.description}</p></div>
        {copy.action && (access?.creationAllowed
          ? <Button asChild><Link to={`${root}/agenda`}><Plus />{copy.action}</Link></Button>
          : <Button disabled><Plus />{copy.action}</Button>)}
      </header>

      {locked ? (
        <Card><CardContent className="grid min-h-72 place-items-center p-8 text-center"><div><span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary text-primary"><LockKeyhole /></span><h2 className="mt-5 text-xl font-semibold">Recurso disponível em outro plano</h2><p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">Você continua com acesso aos dados já produzidos. Compare os planos para liberar novos relatórios.</p><Button asChild className="mt-5"><Link to="/planos">Comparar planos</Link></Button></div></CardContent></Card>
      ) : (
        <>
        {query.data && Object.keys(query.data.summary).length > 0 && (
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo">
            {Object.entries(query.data.summary).map(([key, value]) => (
              <Card key={key}><CardContent className="p-5"><p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{summaryLabel(key)}</p><p className="mt-3 text-2xl font-bold">{formatSummary(value)}</p></CardContent></Card>
            ))}
          </section>
        )}
        <Card>
          <CardHeader className="gap-4 border-b sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-lg">Itens disponíveis</CardTitle>
            <div className="flex flex-col gap-2 sm:flex-row">
              <span className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9 sm:w-64" placeholder="Buscar" aria-label={`Buscar em ${copy.title}`} value={search} onChange={(event) => setSearch(event.target.value)} /></span>
              {section === 'vistorias' ? (
                <label className="relative"><Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><span className="sr-only">Filtrar por status</span><select className="h-11 rounded-md border bg-card pl-9 pr-8 text-sm" value={status} onChange={(event) => setStatus(event.target.value)}><option value="all">Todos os status</option><option value="pendente">Pendente</option><option value="em_andamento">Em andamento</option><option value="concluida">Concluída</option></select></label>
              ) : <Button variant="outline"><Filter />Filtros</Button>}
              {['documentos', 'relatorios'].includes(section) && <Button variant="outline" onClick={exportVisibleItems} disabled={!query.data || (visibleItems.length === 0 && Object.keys(query.data.summary).length === 0)}><Download />Exportar</Button>}
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {query.isLoading && <div className="space-y-3 p-6">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-14" />)}</div>}
            {query.isError && <State title="Não foi possível carregar este módulo." action={<Button variant="outline" onClick={() => void query.refetch()}><RefreshCw />Tentar novamente</Button>} />}
            {query.data && visibleItems.length === 0 && <State title="Nenhum item encontrado" description={query.data.items.length > 0 ? 'Ajuste a busca ou os filtros.' : 'Quando houver registros neste escopo, eles aparecerão aqui.'} />}
            {query.data && visibleItems.length > 0 && (
              <ul className="divide-y">
                {visibleItems.map((item, index) => (
                  <li key={String(item.id ?? index)} className="grid gap-2 px-6 py-4 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                    <div><p className="font-semibold">{String(item.title ?? item.name ?? item.protocol ?? `Registro ${index + 1}`)}</p><p className="mt-1 text-xs text-muted-foreground">{String(item.subtitle ?? item.status ?? item.email ?? 'Disponível')}</p></div>
                    {['vistorias', 'documentos'].includes(section)
                      ? <Button asChild variant="ghost" size="sm" className="min-h-11"><Link to={`${root}/vistorias/${String(item.id)}`}>Ver detalhes</Link></Button>
                      : null}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        </>
      )}
    </div>
  );
}

function summaryLabel(key: string) {
  const labels: Record<string, string> = { inspections: 'Vistorias', generated_at: 'Atualizado em' };
  return labels[key] ?? key.replace(/_/g, ' ');
}

function formatSummary(value: number | string | boolean | null) {
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toLocaleString('pt-BR');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return value ?? '—';
}

function State({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) {
  return <div className="grid min-h-64 place-items-center p-8 text-center"><div><h2 className="font-semibold">{title}</h2>{description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}{action && <div className="mt-4">{action}</div>}</div></div>;
}
