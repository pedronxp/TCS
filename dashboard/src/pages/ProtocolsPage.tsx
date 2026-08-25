import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ArrowRight, FileText, Search, ShieldCheck, SlidersHorizontal, UserRound } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { BrazilMunicipalityPicker, BrazilStateSelect } from '@/components/BrazilMunicipalityPicker';
import { useAuth } from '@/contexts/AuthContext';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { supabase } from '@/lib/supabase';
import { jsonArray, jsonObject, jsonString, jsonNumber } from '@/lib/json';
import type { Json } from '@/types/supabase';

type ProtocolRecord = {
  id: string;
  protocol: string;
  series: string;
  year: number | null;
  sequence: number | null;
  organizationId: string | null;
  agentUserId: string | null;
  city: string;
  agentName: string | null;
  inspectedAt: string | null;
  status: string | null;
  riskLevel: string | null;
  hasLaudo: boolean;
  hasReport: boolean;
  subjectKind: 'individual' | 'municipal';
};

type SeriesRecord = {
  id: string;
  organizationId: string;
  organization: string;
  municipality: string | null;
  code: string;
  active: boolean;
  currentSequence: number;
};

type ProtocolAgent = { userId: string; name: string; inspectionCount: number };
const PAGE_SIZE = 25;

function parseRegistry(data: Json | null): { items: ProtocolRecord[]; total: number } {
  const root = jsonObject(data) || {};
  return {
    total: jsonNumber(root.total) || 0,
    items: jsonArray(root.items).map(jsonObject).filter(Boolean).map((row): ProtocolRecord => ({
      id: jsonString(row?.id) || '', protocol: jsonString(row?.protocol) || '—', series: jsonString(row?.series) || '—',
      year: jsonNumber(row?.year), sequence: jsonNumber(row?.sequence), organizationId: jsonString(row?.organization_id),
      agentUserId: jsonString(row?.agent_user_id),
      city: jsonString(row?.city) || 'Agente individual', agentName: jsonString(row?.agent_name),
      inspectedAt: jsonString(row?.inspected_at), status: jsonString(row?.status), riskLevel: jsonString(row?.risk_level),
      hasLaudo: row?.has_laudo === true, hasReport: row?.has_report === true,
      subjectKind: jsonString(row?.subject_kind) === 'municipal' ? 'municipal' : 'individual',
    })),
  };
}

function parseAgents(data: Json | null): ProtocolAgent[] {
  return jsonArray(data).map(jsonObject).filter(Boolean).map((row) => ({
    userId: jsonString(row?.user_id) || '',
    name: jsonString(row?.name) || 'Usuário sem nome',
    inspectionCount: jsonNumber(row?.inspection_count) || 0,
  })).filter((agent) => Boolean(agent.userId));
}

function parseSeries(data: Json | null): SeriesRecord[] {
  return jsonArray(data).map(jsonObject).filter(Boolean).map((row): SeriesRecord => ({
    id: jsonString(row?.id) || '', organizationId: jsonString(row?.organization_id) || '',
    organization: jsonString(row?.organization) || 'Organização', municipality: jsonString(row?.municipality),
    code: jsonString(row?.code) || '—', active: row?.active === true, currentSequence: jsonNumber(row?.current_sequence) || 0,
  }));
}

const dateFormat = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

export function ProtocolsPage() {
  const { can } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get('busca') ?? '');
  const status = searchParams.get('status') ?? 'all';
  const uf = searchParams.get('uf') ?? '';
  const municipality = searchParams.get('municipio') ?? '';
  const agent = searchParams.get('usuario') ?? 'all';
  const order = searchParams.get('ordem') ?? 'recent';
  const page = Math.max(1, Number(searchParams.get('pagina') ?? '1') || 1);
  const deferredSearch = useDeferredValue(search);
  const [selectedSeries, setSelectedSeries] = useState<SeriesRecord | null>(null);
  const [nextCode, setNextCode] = useState('');
  const [confirmingRotation, setConfirmingRotation] = useState(false);
  const canRotate = can('protocol.rotate');
  useEffect(() => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (deferredSearch.trim()) next.set('busca', deferredSearch.trim()); else next.delete('busca');
      if (deferredSearch.trim() !== (current.get('busca') ?? '')) next.delete('pagina');
      return next;
    }, { replace: true });
  }, [deferredSearch, setSearchParams]);

  function updateFilter(key: string, value: string, emptyValue = 'all', resetPage = true) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (!value || value === emptyValue) next.delete(key); else next.set(key, value);
      if (resetPage) next.delete('pagina');
      return next;
    }, { replace: true });
  }

  const registry = useQuery({
    queryKey: ['protocol-registry', deferredSearch, status, uf, municipality, agent, order, page],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: Json | null; error: Error | null }>)('search_internal_protocol_registry', {
        p_search: deferredSearch.trim() || null, p_status: status === 'all' ? null : status,
        p_uf: uf || null, p_municipio: municipality || null,
        p_agent_user_id: agent === 'all' ? null : agent, p_order: order,
        p_limit: PAGE_SIZE, p_offset: (page - 1) * PAGE_SIZE, p_organization_id: null,
      });
      if (error) throw error;
      return parseRegistry(data);
    },
  });
  const agents = useQuery({
    queryKey: ['protocol-agents'],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as (name: string) => PromiseLike<{ data: Json | null; error: Error | null }>)('list_internal_protocol_agents');
      if (error) throw error;
      return parseAgents(data);
    },
  });
  const series = useQuery({
    queryKey: ['protocol-series'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_internal_protocol_series');
      if (error) throw error;
      return parseSeries(data);
    },
  });
  const rotation = useAdministrativeMutation<{ series: SeriesRecord; code: string; reason: string }, unknown>({
    mutationFn: async (input, operationId) => {
      const { data, error } = await supabase.rpc('rotate_internal_protocol_series', {
        p_organization_id: input.series.organizationId, p_code: input.code, p_reason: input.reason, p_operation_id: operationId,
      });
      if (error) throw error;
      return data;
    },
    invalidate: [['protocol-registry'], ['protocol-series'], ['audit-timeline']],
  });

  const records = registry.data?.items || [];
  const rows = series.data || [];
  const totalPages = Math.max(1, Math.ceil((registry.data?.total ?? 0) / PAGE_SIZE));
  const activeFilterCount = useMemo(() => [status !== 'all', Boolean(uf), Boolean(municipality), agent !== 'all', order !== 'recent'].filter(Boolean).length, [agent, municipality, order, status, uf]);
  return (
    <section className="page-stack mx-auto w-full max-w-[1160px]">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Rastreabilidade</p>
        <h1 className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.035em]">Pesquisa de protocolos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Encontre uma vistoria e abra seu histórico, resultados, documentos e eventos de emissão.</p>
      </header>

      <Card className="shadow-none">
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <div><h2 className="text-[17px] font-semibold">Localizar vistoria</h2><p className="mt-1 text-xs text-muted-foreground">Busca, responsável, território, estado e ordem trabalham juntos.</p></div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground"><SlidersHorizontal className="h-3.5 w-3.5" />{activeFilterCount} filtro{activeFilterCount === 1 ? '' : 's'}</span>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <label className="relative block max-w-xl flex-1"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Protocolo, cidade, prefeitura, agente ou risco" aria-label="Pesquisar protocolos" /></label>
            <Select value={agent} onValueChange={(value) => updateFilter('usuario', value)}><SelectTrigger aria-label="Filtrar por usuário"><UserRound className="h-4 w-4" /><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os usuários</SelectItem>{(agents.data ?? []).map((item) => <SelectItem key={item.userId} value={item.userId}>{item.name} ({item.inspectionCount})</SelectItem>)}</SelectContent></Select>
            <BrazilStateSelect value={uf} onValueChange={(nextUf) => { updateFilter('uf', nextUf, ''); updateFilter('municipio', '', ''); }} includeAll />
            <BrazilMunicipalityPicker uf={uf} value={municipality} onValueChange={(value) => updateFilter('municipio', value, '')} placeholder="Selecionar município" />
            <Select value={status} onValueChange={(value) => updateFilter('status', value)}><SelectTrigger aria-label="Filtrar status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos os status</SelectItem><SelectItem value="concluida">Concluída</SelectItem><SelectItem value="pendente">Pendente</SelectItem><SelectItem value="rascunho">Rascunho</SelectItem></SelectContent></Select>
            <Select value={order} onValueChange={(value) => updateFilter('ordem', value, 'recent')}><SelectTrigger aria-label="Ordenar protocolos"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="recent">Últimos criados</SelectItem><SelectItem value="oldest">Mais antigos</SelectItem></SelectContent></Select>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground"><p>{registry.data ? `${registry.data.total} registro(s) encontrado(s) · página ${page} de ${totalPages}.` : 'Carregando registros...'}</p>{(activeFilterCount > 0 || search) && <Button size="sm" variant="ghost" onClick={() => { setSearch(''); setSearchParams({}, { replace: true }); }}>Limpar filtros</Button>}</div>
          <AsyncBoundary loading={registry.isLoading} error={registry.error} onRetry={() => void registry.refetch()}>
            {records.length === 0 ? <p className="mt-4 rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhuma vistoria corresponde aos filtros selecionados.</p> : <>
              <div className="mt-4 hidden overflow-x-auto md:block"><table className="w-full min-w-[900px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="p-3">Protocolo</th><th className="p-3">Origem</th><th className="p-3">Vistoria</th><th className="p-3">Responsável</th><th className="p-3">Estado</th><th className="p-3 text-right">Ação</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b last:border-0 hover:bg-muted/40"><td className="p-3 font-mono text-xs font-semibold">{record.protocol}<p className="mt-1 flex gap-1">{record.riskLevel && <span className="rounded bg-warning-soft px-1.5 py-0.5 text-[10px] font-bold text-warning-foreground">{record.riskLevel.toUpperCase()}</span>}{record.hasLaudo && <span title="Laudo gerado"><FileText className="h-3.5 w-3.5 text-primary" /></span>}</p></td><td className="p-3"><p>{record.city}</p><p className="mt-1 text-xs text-muted-foreground">{record.subjectKind === 'municipal' ? 'Municipal' : 'Agente individual'} · série {record.series}</p></td><td className="p-3 text-muted-foreground">{record.inspectedAt ? dateFormat.format(new Date(record.inspectedAt)) : 'Sem data'}</td><td className="p-3">{record.agentName || '—'}</td><td className="p-3 text-xs capitalize text-muted-foreground">{record.status || '—'}</td><td className="p-3 text-right"><Button asChild size="sm" variant="outline"><Link to={`/app/protocolos/${record.id}`}>Ver vistoria<ArrowRight className="h-4 w-4" /></Link></Button></td></tr>)}</tbody></table></div>
              <ul className="mt-4 divide-y rounded-xl border md:hidden">{records.map((record) => <li key={record.id} className="space-y-3 p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-mono text-xs font-semibold">{record.protocol}</p><p className="mt-1 text-sm font-medium">{record.city}</p></div><span className="rounded-full bg-secondary px-2 py-1 text-[10px] capitalize">{record.status || '—'}</span></div><dl className="grid grid-cols-2 gap-2 text-xs"><div><dt className="text-muted-foreground">Responsável</dt><dd className="mt-1 font-medium">{record.agentName || '—'}</dd></div><div><dt className="text-muted-foreground">Vistoria</dt><dd className="mt-1">{record.inspectedAt ? dateFormat.format(new Date(record.inspectedAt)) : 'Sem data'}</dd></div></dl><Button asChild size="sm" variant="outline" className="w-full"><Link to={`/app/protocolos/${record.id}`}>Ver vistoria<ArrowRight /></Link></Button></li>)}</ul>
            </>}
          </AsyncBoundary>
          {totalPages > 1 && <nav className="mt-5 flex items-center justify-between gap-3" aria-label="Paginação de protocolos"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => updateFilter('pagina', String(page - 1), '', false)}><ArrowLeft />Anterior</Button><span className="text-xs text-muted-foreground">{page} de {totalPages}</span><Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => updateFilter('pagina', String(page + 1), '', false)}>Próxima<ArrowRight /></Button></nav>}
        </CardContent>
      </Card>

      <Card className="shadow-none">
        <CardHeader><h2 className="text-[17px] font-semibold">Séries municipais</h2></CardHeader>
        <CardContent><AsyncBoundary loading={series.isLoading} error={series.error} onRetry={() => void series.refetch()}>
          <div className="grid gap-3 md:grid-cols-2">{rows.map((item) => <article key={item.id} className="rounded-xl border p-4"><div className="flex items-start justify-between gap-3"><div><p className="font-semibold">{item.organization}</p><p className="mt-1 text-xs text-muted-foreground">{item.municipality || 'Município não informado'}</p></div><span className={item.active ? 'rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary' : 'rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground'}>{item.active ? 'ATIVA' : 'HISTÓRICA'}</span></div><p className="mt-4 font-mono text-sm font-bold">TCS-{item.code}-AAAA-000001</p><p className="mt-2 text-xs text-muted-foreground">Sequência atual do ano: {item.currentSequence}</p>{canRotate && item.active && <Button variant="outline" className="mt-4" onClick={() => { setSelectedSeries(item); setNextCode(''); }}><ShieldCheck className="h-4 w-4" />Nova série</Button>}</article>)}</div>
        </AsyncBoundary></CardContent>
      </Card>

      <HighRiskDialog open={confirmingRotation} title="Criar nova série de protocolo" description={`A série atual de ${selectedSeries?.organization || 'esta prefeitura'} será preservada como histórica. Nenhum protocolo emitido será alterado.`} confirmLabel="Criar série auditada" onClose={() => setConfirmingRotation(false)} onConfirm={async (reason) => {
        if (!selectedSeries || !nextCode.trim()) throw new Error('Informe o código da nova série.');
        const result = await rotation.mutateAsync({ series: selectedSeries, code: nextCode.trim().toUpperCase(), reason });
        if (!result.ok) throw new Error(result.error || 'Não foi possível criar a série.');
        setConfirmingRotation(false);
        setSelectedSeries(null);
      }} />
      {selectedSeries && !confirmingRotation && <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/35 p-4"><Card className="w-full max-w-md"><CardHeader><h2 className="text-lg font-semibold">Código da nova série</h2></CardHeader><CardContent><Input value={nextCode} onChange={(event) => setNextCode(event.target.value.replace(/[^a-zA-Z0-9-]/g, '').toUpperCase())} placeholder="Ex.: CATAGUASES-2027" aria-label="Código da nova série" /><p className="mt-3 text-xs text-muted-foreground">Depois de informar o código, confirme a operação com MFA e justificativa.</p><div className="mt-5 flex justify-end gap-2"><Button variant="ghost" onClick={() => setSelectedSeries(null)}>Cancelar</Button><Button disabled={!nextCode.trim()} onClick={() => setConfirmingRotation(true)}>Continuar</Button></div></CardContent></Card></div>}
    </section>
  );
}
