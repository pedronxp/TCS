import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, ShieldCheck } from 'lucide-react';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
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
  city: string;
  agentName: string | null;
  inspectedAt: string | null;
  status: string | null;
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

function parseRegistry(data: Json | null): { items: ProtocolRecord[]; total: number } {
  const root = jsonObject(data) || {};
  return {
    total: jsonNumber(root.total) || 0,
    items: jsonArray(root.items).map(jsonObject).filter(Boolean).map((row): ProtocolRecord => ({
      id: jsonString(row?.id) || '', protocol: jsonString(row?.protocol) || '—', series: jsonString(row?.series) || '—',
      year: jsonNumber(row?.year), sequence: jsonNumber(row?.sequence), organizationId: jsonString(row?.organization_id),
      city: jsonString(row?.city) || 'Agente individual', agentName: jsonString(row?.agent_name),
      inspectedAt: jsonString(row?.inspected_at), status: jsonString(row?.status),
      subjectKind: jsonString(row?.subject_kind) === 'municipal' ? 'municipal' : 'individual',
    })),
  };
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
  const [search, setSearch] = useState('');
  const [selectedSeries, setSelectedSeries] = useState<SeriesRecord | null>(null);
  const [nextCode, setNextCode] = useState('');
  const [confirmingRotation, setConfirmingRotation] = useState(false);
  const canRotate = can('protocol.rotate');
  const registry = useQuery({
    queryKey: ['protocol-registry', search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_internal_protocol_registry', { p_search: search.trim() || null, p_limit: 100, p_offset: 0, p_organization_id: null });
      if (error) throw error;
      return parseRegistry(data);
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
  return (
    <section className="page-stack max-w-[1160px]">
      <header>
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Rastreabilidade</p>
        <h1 className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.035em]">Protocolos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Consulte a origem de cada protocolo e acompanhe séries anuais sem apagar ou reutilizar históricos.</p>
      </header>

      <Card className="shadow-none">
        <CardHeader><h2 className="text-[17px] font-semibold">Pesquisar protocolo</h2></CardHeader>
        <CardContent>
          <label className="relative block max-w-xl"><Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="pl-9" placeholder="Protocolo, cidade ou prefeitura" aria-label="Pesquisar protocolos" /></label>
          <p className="mt-3 text-xs text-muted-foreground">{registry.data ? `${registry.data.total} registro(s) encontrado(s)` : 'Carregando registros...'}</p>
          <AsyncBoundary loading={registry.isLoading} error={registry.error} onRetry={() => void registry.refetch()}>
            <div className="mt-4 overflow-x-auto"><table className="w-full min-w-[760px] text-left text-sm"><thead className="border-b text-xs text-muted-foreground"><tr><th className="p-3">Protocolo</th><th className="p-3">Origem</th><th className="p-3">Vistoria</th><th className="p-3">Responsável</th><th className="p-3">Estado</th></tr></thead><tbody>{records.map((record) => <tr key={record.id} className="border-b last:border-0"><td className="p-3 font-mono text-xs font-semibold">{record.protocol}</td><td className="p-3"><p>{record.city}</p><p className="mt-1 text-xs text-muted-foreground">{record.subjectKind === 'municipal' ? 'Municipal' : 'Agente individual'} · série {record.series}</p></td><td className="p-3 text-muted-foreground">{record.inspectedAt ? dateFormat.format(new Date(record.inspectedAt)) : 'Sem data'}</td><td className="p-3">{record.agentName || '—'}</td><td className="p-3 text-xs capitalize text-muted-foreground">{record.status || '—'}</td></tr>)}</tbody></table></div>
          </AsyncBoundary>
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
