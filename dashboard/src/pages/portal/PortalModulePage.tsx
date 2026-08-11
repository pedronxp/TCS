import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Download, FileText, Filter, LockKeyhole, Plus, RefreshCw, Search } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace, portalHome } from '@/lib/portal';

const moduleCopy: Record<string, { title: string; description: string; action?: string; eyebrow: string }> = {
  vistorias: { title: 'Vistorias', description: 'Consulte os registros técnicos autorizados para o seu escopo.', action: 'Novo agendamento', eyebrow: 'Operação' },
  documentos: { title: 'Documentos', description: 'Acesse laudos disponíveis por meio de links temporários e auditáveis.', eyebrow: 'Acervo técnico' },
  relatorios: { title: 'Relatórios', description: 'Veja indicadores calculados para seu escopo e exporte o recorte disponível.', eyebrow: 'Análise' },
  consumo: { title: 'Consumo', description: 'Compare o uso registrado com os limites da versão do seu plano.', eyebrow: 'Plano e uso' },
  equipe: { title: 'Equipe', description: 'Pessoas e papéis que compõem a operação municipal.', eyebrow: 'Gestão municipal' },
  convites: { title: 'Convites', description: 'Acompanhe convites pendentes, aceitos, expirados ou revogados.', action: 'Convidar pessoa', eyebrow: 'Gestão municipal' },
  assinatura: { title: 'Assinatura', description: 'Plano, ciclo financeiro e ações de cobrança disponíveis.', eyebrow: 'Conta' },
  suporte: { title: 'Suporte', description: 'Solicitações próprias ou da organização conforme seu escopo.', action: 'Abrir chamado', eyebrow: 'Atendimento' },
  configuracoes: { title: 'Configurações', description: 'Preferências da operação municipal com alterações auditáveis.', eyebrow: 'Gestão municipal' },
  perfil: { title: 'Perfil e segurança', description: 'Seus dados, sessões e opções de segurança da conta.', eyebrow: 'Conta' },
};

export function PortalModulePage({ section }: { section: string }) {
  const { access } = usePortalAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const search = searchParams.get('busca') ?? '';
  const status = searchParams.get('status') ?? 'all';
  const copy = moduleCopy[section] ?? { title: section, description: 'Módulo do portal.', eyebrow: 'Portal' };
  const locked = section === 'relatorios' && access?.features.reports !== true;
  const query = useQuery({
    queryKey: ['portal', 'workspace', section, access?.userId, access?.accountKind, access?.organizationId, access?.role],
    queryFn: () => fetchPortalWorkspace(section),
    enabled: Boolean(access && !locked),
  });
  const root = portalHome(access?.accountKind ?? 'individual');
  const canOpenInspection = access?.permissions?.includes('inspection.read') !== false;
  const canSchedule = access?.creationAllowed === true && access.permissions?.includes('appointment.read') !== false;
  const statusOptions = useMemo(
    () => Array.from(new Set((query.data?.items ?? []).map((item) => String(item.status ?? '')).filter(Boolean))),
    [query.data?.items],
  );
  const visibleItems = (query.data?.items ?? []).filter((item) => {
    const haystack = `${item.title ?? ''} ${item.name ?? ''} ${item.protocol ?? ''} ${item.subtitle ?? ''}`.toLocaleLowerCase('pt-BR');
    const matchesSearch = haystack.includes(search.trim().toLocaleLowerCase('pt-BR'));
    const matchesStatus = status === 'all' || String(item.status ?? '') === status;
    return matchesSearch && matchesStatus;
  });
  const isSummaryOnly = section === 'relatorios';

  function updateFilter(key: 'busca' | 'status', value: string) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || (key === 'status' && value === 'all')) next.delete(key);
      else next.set(key, value);
      return next;
    }, { replace: true });
  }

  function exportVisibleItems() {
    const rows: Array<Record<string, unknown>> = visibleItems.length > 0
      ? visibleItems
      : Object.entries(query.data?.summary ?? {}).map(([key, value]) => ({ indicador: summaryLabel(key), valor: value }));
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
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">{copy.eyebrow}</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em]">{copy.title}</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{copy.description}</p>
        </div>
        {copy.action && (canSchedule
          ? <Button asChild><Link to={`${root}/agenda?novo=1`}><Plus aria-hidden="true" />{copy.action}</Link></Button>
          : <Button disabled title="Ação indisponível para este acesso"><Plus aria-hidden="true" />{copy.action}</Button>)}
      </header>

      {locked ? (
        <PlanLockedState root={root} canReadBilling={access?.permissions?.includes('billing.read') === true} />
      ) : (
        <>
          {query.data && Object.keys(query.data.summary).length > 0 && (
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4" aria-label="Resumo do módulo">
              {Object.entries(query.data.summary).map(([key, value]) => (
                <Card key={key}>
                  <CardContent className="p-5">
                    <p className="text-xs font-medium uppercase tracking-[0.08em] text-muted-foreground">{summaryLabel(key)}</p>
                    <p className="mt-3 text-2xl font-bold tabular-nums">{formatSummary(value)}</p>
                  </CardContent>
                </Card>
              ))}
            </section>
          )}

          <Card aria-busy={query.isLoading}>
            <CardHeader className="min-h-[89px] gap-4 border-b border-border sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="text-lg">{isSummaryOnly ? 'Recorte disponível' : 'Itens disponíveis'}</CardTitle>
                <p className="mt-1 min-h-4 text-xs text-muted-foreground" aria-live="polite">
                  {query.isFetching && !query.isLoading ? 'Atualizando dados sem alterar sua posição…' : ''}
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                {!isSummaryOnly && (
                  <>
                    <label className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <span className="sr-only">Buscar em {copy.title}</span>
                      <Input className="pl-9 sm:w-64" placeholder={`Buscar em ${copy.title.toLocaleLowerCase('pt-BR')}`} value={search} onChange={(event) => updateFilter('busca', event.target.value)} />
                    </label>
                    <label className="relative">
                      <Filter className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                      <span className="sr-only">Filtrar por status</span>
                      <select className="h-11 min-w-44 rounded-md border border-border bg-card pl-9 pr-8 text-sm" value={status} onChange={(event) => updateFilter('status', event.target.value)}>
                        <option value="all">Todos os status</option>
                        {statusOptions.map((option) => <option key={option} value={option}>{humanize(option)}</option>)}
                      </select>
                    </label>
                  </>
                )}
                {['documentos', 'relatorios'].includes(section) && (
                  <Button variant="outline" onClick={exportVisibleItems} disabled={!query.data || (visibleItems.length === 0 && Object.keys(query.data.summary).length === 0)}>
                    <Download aria-hidden="true" />Exportar {section === 'documentos' ? 'lista' : 'recorte'}
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {query.isLoading && <ModuleSkeleton />}
              {query.isError && <ModuleState kind="error" title="Não foi possível carregar este módulo" description="Nenhum dado foi estimado ou substituído." action={<Button variant="outline" onClick={() => void query.refetch()}><RefreshCw aria-hidden="true" />Tentar novamente</Button>} />}
              {query.data && isSummaryOnly && (
                <ModuleState
                  title={Object.keys(query.data.summary).length > 0 ? 'Relatório pronto para exportação' : 'Nenhum indicador disponível'}
                  description={Object.keys(query.data.summary).length > 0 ? 'O arquivo usa exatamente os indicadores mostrados acima.' : 'Seu plano permite relatórios, mas este escopo ainda não possui indicadores.'}
                  icon={<FileText className="h-5 w-5" aria-hidden="true" />}
                />
              )}
              {query.data && !isSummaryOnly && visibleItems.length === 0 && (
                <ModuleState title="Nenhum item encontrado" description={query.data.items.length > 0 ? 'Ajuste a busca ou o filtro sem perder sua posição na lista.' : emptyDescription(section)} />
              )}
              {query.data && !isSummaryOnly && visibleItems.length > 0 && (
                <ul className="divide-y divide-border">
                  {visibleItems.map((item, index) => (
                    <ModuleRow key={String(item.id ?? index)} item={item} index={index} section={section} root={root} returnTo={`${location.pathname}${location.search}`} canOpenInspection={canOpenInspection} />
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

function ModuleRow({ item, index, section, root, returnTo, canOpenInspection }: { item: Record<string, unknown>; index: number; section: string; root: string; returnTo: string; canOpenInspection: boolean }) {
  const title = String(item.title ?? item.name ?? item.protocol ?? `Registro ${index + 1}`);
  const subtitle = String(item.subtitle ?? item.email ?? 'Disponível');
  const status = item.status ? humanize(String(item.status)) : null;
  const inspectionLink = `${root}/vistorias/${encodeURIComponent(String(item.id))}?returnTo=${encodeURIComponent(returnTo)}`;
  return (
    <li className="grid min-h-[76px] gap-3 px-6 py-4 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
      <div className="min-w-0">
        <p className="truncate font-semibold">{title}</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}{status ? ` · ${status}` : ''}</p>
      </div>
      {canOpenInspection && section === 'vistorias' && <Button asChild variant="ghost" size="sm" className="min-h-11"><Link to={inspectionLink}>Ver detalhes</Link></Button>}
      {canOpenInspection && section === 'documentos' && <Button asChild variant="ghost" size="sm" className="min-h-11"><Link to={inspectionLink}>Abrir laudo</Link></Button>}
    </li>
  );
}

function PlanLockedState({ root, canReadBilling }: { root: string; canReadBilling: boolean }) {
  return (
    <Card>
      <CardContent className="grid min-h-72 place-items-center p-8 text-center">
        <div>
          <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-secondary text-primary"><LockKeyhole aria-hidden="true" /></span>
          <h2 className="mt-5 text-xl font-semibold">Relatórios não incluídos neste plano</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Os demais módulos e dados já produzidos continuam disponíveis conforme suas permissões.</p>
          <Button asChild className="mt-5"><Link to={canReadBilling ? `${root}/assinatura` : '/planos'}>{canReadBilling ? 'Consultar assinatura' : 'Comparar planos'}</Link></Button>
        </div>
      </CardContent>
    </Card>
  );
}

function ModuleSkeleton() {
  return (
    <div className="space-y-3 p-6" role="status" aria-label="Carregando itens">
      <span className="sr-only">Carregando itens…</span>
      {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-[76px] motion-reduce:animate-none" />)}
    </div>
  );
}

function ModuleState({ title, description, action, icon, kind }: { title: string; description?: string; action?: React.ReactNode; icon?: React.ReactNode; kind?: 'error' }) {
  return (
    <div className="grid min-h-64 place-items-center p-8 text-center" role={kind === 'error' ? 'alert' : undefined}>
      <div>
        {icon && <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-secondary text-primary">{icon}</span>}
        <h2 className={icon ? 'mt-4 font-semibold' : 'font-semibold'}>{title}</h2>
        {description && <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>}
        {action && <div className="mt-4">{action}</div>}
      </div>
    </div>
  );
}

function summaryLabel(key: string) {
  const labels: Record<string, string> = { inspections: 'Vistorias no escopo', generated_at: 'Atualizado em' };
  return labels[key] ?? humanize(key);
}

function formatSummary(value: number | string | boolean | null) {
  if (typeof value === 'number') return value.toLocaleString('pt-BR');
  if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) return new Date(value).toLocaleString('pt-BR');
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  return value ?? '—';
}

function humanize(value: string) {
  const normalized = value.replace(/_/g, ' ');
  return normalized.charAt(0).toLocaleUpperCase('pt-BR') + normalized.slice(1);
}

function emptyDescription(section: string) {
  const descriptions: Record<string, string> = {
    vistorias: 'Nenhuma vistoria foi registrada neste escopo.',
    documentos: 'Nenhum laudo está disponível para as vistorias deste escopo.',
    consumo: 'Nenhum consumo foi registrado para o período atual.',
  };
  return descriptions[section] ?? 'Quando houver registros neste escopo, eles aparecerão aqui.';
}
