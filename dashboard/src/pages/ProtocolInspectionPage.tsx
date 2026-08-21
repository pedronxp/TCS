import { useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ClipboardCheck, Download, ExternalLink, Eye, FileCheck2, Image, MapPin, ShieldAlert, TimerReset } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { supabase } from '@/lib/supabase';

type TimelineEvent = { kind: string; label: string; detail?: string; occurred_at: string | null };
type InspectionDetail = {
  id: string;
  protocol: string;
  status: string;
  riskLevel: string | null;
  score: number | null;
  occurredAt: string | null;
  organization: string | null;
  municipality: string | null;
  agentName: string | null;
  responsibleName: string | null;
  formId: string | null;
  formVersion: number | null;
  synchronized: boolean | null;
  photoCount: number;
  address: string | null;
  canViewSensitive: boolean;
  answers: unknown;
  documents: { laudo: boolean; report: boolean; term: boolean };
  timeline: TimelineEvent[];
};

type ResourceKind = 'laudo' | 'photo';
type AuthorizedResource = { url: string; filename: string };
type ResourceResult = { kind: ResourceKind; mode: 'view' | 'download'; resources: AuthorizedResource[] };

export function ProtocolInspectionPage() {
  const { inspectionId } = useParams();
  const query = useQuery({
    queryKey: ['protocol-inspection', inspectionId],
    enabled: Boolean(inspectionId),
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: Error | null }>)('get_internal_protocol_inspection', { p_inspection_id: inspectionId });
      const inspection = normalizeInspectionDetail(data);
      if (error || !inspection) throw new Error(error?.message ?? 'vistoria_indisponivel');
      return inspection;
    },
  });

  return (
    <div className="page-stack mx-auto max-w-[1180px]">
      <header>
        <Button asChild variant="ghost" className="-ml-3"><Link to="/app/protocolos"><ArrowLeft aria-hidden="true" />Voltar aos protocolos</Link></Button>
        {query.data ? (
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-2xl font-bold tracking-[-0.025em] sm:text-3xl">{query.data.protocol}</h1>
            <Badge variant={query.data.status === 'concluida' || query.data.status === 'concluída' ? 'success' : 'secondary'}>{label(query.data.status)}</Badge>
            {query.data.riskLevel && <Badge variant="warning">{query.data.riskLevel.toUpperCase()}</Badge>}
          </div>
        ) : <h1 className="mt-3 text-3xl font-semibold">Investigação da vistoria</h1>}
        <p className="mt-2 text-sm text-muted-foreground">Linha do tempo, evidências operacionais e resultado da vistoria em uma única consulta auditada.</p>
      </header>

      <AsyncBoundary loading={query.isLoading} error={query.error} onRetry={() => void query.refetch()} loadingLabel="Carregando a vistoria…">
        {query.data ? <InspectionWorkspace inspection={query.data} /> : null}
      </AsyncBoundary>
    </div>
  );
}

function InspectionWorkspace({ inspection }: { inspection: InspectionDetail }) {
  const [resource, setResource] = useState<ResourceResult | null>(null);
  const [requesting, setRequesting] = useState<string | null>(null);
  const [resourceError, setResourceError] = useState<string | null>(null);

  async function authorizeResource(kind: ResourceKind, mode: 'view' | 'download' = 'view') {
    if (requesting) return;
    setRequesting(`${kind}:${mode}`);
    setResource(null);
    setResourceError(null);
    try {
      const { data, error } = await supabase.functions.invoke('internal-protocol-resource', {
        body: { inspection_id: inspection.id, kind, mode },
      });
      const resources = parseAuthorizedResources(data, kind, mode);
      if (error || !resources) throw new Error('resource_not_authorized');
      setResource({ kind, mode, resources });
    } catch {
      setResourceError('Não foi possível autorizar este arquivo. Verifique o acesso sensível e tente novamente.');
    } finally {
      setRequesting(null);
    }
  }

  const authorizedLaudo = resource?.kind === 'laudo' ? resource.resources[0] : null;
  const authorizedPhotos = resource?.kind === 'photo' ? resource.resources : [];
  return (
    <>
      <section className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><ClipboardCheck className="h-5 w-5 text-primary" />Resumo da vistoria</CardTitle></CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Info label="Data da vistoria" value={formatDate(inspection.occurredAt)} />
            <Info label="Pontuação" value={inspection.score?.toLocaleString('pt-BR') ?? 'Não calculada'} />
            <Info label="Responsável" value={inspection.responsibleName ?? inspection.agentName ?? 'Não informado'} />
            <Info label="Origem" value={inspection.organization ?? inspection.municipality ?? 'Agente individual'} />
            <Info label="Formulário" value={inspection.formId ? `${inspection.formId}${inspection.formVersion ? ` · v${inspection.formVersion}` : ''}` : 'Não informado'} />
            <Info label="Sincronização" value={inspection.synchronized ? 'Sincronizada' : 'Pendente ou não informada'} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-primary" />Evidências geradas</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <EvidenceRow label="Laudo" available={inspection.documents.laudo}>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => void authorizeResource('laudo')} disabled={!inspection.documents.laudo || requesting !== null}><Eye aria-hidden="true" />{requesting === 'laudo:view' ? 'Autorizando…' : 'Ver'}</Button>
                <Button size="sm" variant="outline" onClick={() => void authorizeResource('laudo', 'download')} disabled={!inspection.documents.laudo || requesting !== null}><Download aria-hidden="true" />{requesting === 'laudo:download' ? 'Autorizando…' : 'Baixar'}</Button>
                <Button asChild size="sm" variant="ghost"><Link to={`/app/protocolos/${inspection.id}/laudo`}>Área do laudo<ExternalLink aria-hidden="true" /></Link></Button>
              </div>
            </EvidenceRow>
            <EvidenceRow label="Relatório" available={inspection.documents.report} detail="Edite a observação complementar e gere uma emissão em PDF pela área web.">
              <Button asChild size="sm" variant="outline"><Link to={`/app/protocolos/${inspection.id}/relatorio`}>Gerar ou editar<ExternalLink aria-hidden="true" /></Link></Button>
            </EvidenceRow>
            <EvidenceRow label="Termo" available={inspection.documents.term} detail="Preencha a identificação do notificado e gere o Termo pela área web quando a classificação permitir.">
              <Button asChild size="sm" variant="outline"><Link to={`/app/protocolos/${inspection.id}/termo`}>Gerar Termo<ExternalLink aria-hidden="true" /></Link></Button>
            </EvidenceRow>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
              <span className="flex items-center gap-2"><Image className="h-4 w-4" />Fotos registradas <strong>{inspection.photoCount}</strong></span>
              <div className="flex flex-wrap gap-2">{inspection.photoCount > 0 && <Button size="sm" variant="outline" onClick={() => void authorizeResource('photo')} disabled={requesting !== null}><Eye aria-hidden="true" />{requesting === 'photo:view' ? 'Abrindo…' : 'Visualizar fotos'}</Button>}<Button asChild size="sm" variant="ghost"><Link to={`/app/protocolos/${inspection.id}/fotos`}>Área das fotos<ExternalLink aria-hidden="true" /></Link></Button></div>
            </div>
            {authorizedLaudo && <div className="rounded-lg border border-success/30 bg-success-soft/30 p-3 text-sm" role="status"><p>Link temporário autorizado. Ele expira em breve para proteger o documento.</p><Button asChild size="sm" className="mt-3"><a href={authorizedLaudo.url} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true" />{resource?.mode === 'download' ? 'Baixar laudo autorizado' : 'Abrir laudo autorizado'}</a></Button></div>}
            {resourceError && <p className="text-sm text-destructive" role="alert">{resourceError}</p>}
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.85fr_1.15fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><TimerReset className="h-5 w-5 text-primary" />Tudo que aconteceu</CardTitle></CardHeader>
          <CardContent>
            {inspection.timeline.length ? <ol className="space-y-4 border-l border-border pl-5">{inspection.timeline.map((event, index) => <li key={`${event.kind}-${index}`} className="relative"><span className="absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full bg-primary" /><p className="text-sm font-medium">{event.label}</p>{event.detail && <p className="font-mono text-xs text-muted-foreground">{event.detail}</p>}<p className="mt-1 text-xs text-muted-foreground">{formatDate(event.occurred_at)}</p></li>)}</ol> : <p className="text-sm text-muted-foreground">Não há eventos com data para compor a linha do tempo.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5 text-primary" />Dados da execução</CardTitle></CardHeader>
          <CardContent className="space-y-5">
            {inspection.canViewSensitive ? <Info label="Endereço" value={inspection.address ?? 'Não informado'} /> : <div className="rounded-lg border border-warning/30 bg-warning-soft/30 p-4 text-sm text-muted-foreground"><p className="flex items-center gap-2 font-medium text-foreground"><ShieldAlert className="h-4 w-4 text-warning-foreground" />Dados pessoais protegidos</p><p className="mt-1">O endereço e as respostas só são exibidos com acesso sensível à organização ou à conta vinculada.</p></div>}
          </CardContent>
        </Card>
      </section>
      <Dialog open={authorizedPhotos.length > 0} onOpenChange={(open) => { if (!open) setResource(null); }}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>Fotos registradas</DialogTitle>
            <DialogDescription>As imagens são acessadas por links temporários e não ficam expostas no histórico público.</DialogDescription>
          </DialogHeader>
          <div className="grid max-h-[65vh] gap-3 overflow-y-auto sm:grid-cols-2">
            {authorizedPhotos.map((photo, index) => <a key={photo.url} href={photo.url} target="_blank" rel="noopener noreferrer" className="overflow-hidden rounded-lg border bg-muted focus:outline-none focus:ring-2 focus:ring-ring"><img src={photo.url} alt={`Foto registrada ${index + 1}`} className="h-56 w-full object-cover" /><span className="flex items-center justify-between gap-2 p-3 text-sm font-medium">Foto {index + 1}<ExternalLink className="h-4 w-4" aria-hidden="true" /></span></a>)}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function EvidenceRow({ label: name, available, detail, children }: { label: string; available: boolean; detail?: string; children?: ReactNode }) {
  return <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm"><div><p>{name}</p>{detail && <p className="mt-1 max-w-sm text-xs text-muted-foreground">{detail}</p>}</div><div className="flex items-center gap-2"><Badge variant={available ? 'success' : 'secondary'}>{available ? 'Disponível' : 'Não gerado'}</Badge>{children}</div></div>;
}

function Info({ label: name, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted/60 p-3"><p className="text-xs text-muted-foreground">{name}</p><p className="mt-1 text-sm font-medium">{value}</p></div>;
}

function normalizeInspectionDetail(value: unknown): InspectionDetail | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || typeof row.protocol !== 'string' || typeof row.status !== 'string') return null;
  const documents = row.documents && typeof row.documents === 'object' && !Array.isArray(row.documents) ? row.documents as Record<string, unknown> : null;
  if (!documents || !Array.isArray(row.timeline)) return null;
  return {
    id: row.id,
    protocol: row.protocol,
    status: row.status,
    riskLevel: nullableString(row.risk_level ?? row.riskLevel),
    score: nullableNumber(row.score),
    occurredAt: nullableString(row.occurred_at ?? row.occurredAt),
    organization: nullableString(row.organization),
    municipality: nullableString(row.municipality),
    agentName: nullableString(row.agent_name ?? row.agentName),
    responsibleName: nullableString(row.responsible_name ?? row.responsibleName),
    formId: nullableString(row.form_id ?? row.formId),
    formVersion: nullableNumber(row.form_version ?? row.formVersion),
    synchronized: nullableBoolean(row.synchronized),
    photoCount: Math.max(0, Math.trunc(nullableNumber(row.photo_count ?? row.photoCount) ?? 0)),
    address: nullableString(row.address),
    canViewSensitive: row.can_view_sensitive === true || row.canViewSensitive === true,
    answers: row.answers ?? null,
    documents: { laudo: documents.laudo === true, report: documents.report === true, term: documents.term === true },
    timeline: row.timeline.map(normalizeTimelineEvent).filter((event): event is TimelineEvent => event !== null),
  };
}

function normalizeTimelineEvent(value: unknown): TimelineEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  if (typeof row.kind !== 'string' || typeof row.label !== 'string') return null;
  return { kind: row.kind, label: row.label, detail: nullableString(row.detail) ?? undefined, occurred_at: nullableString(row.occurred_at) };
}

function nullableString(value: unknown): string | null { return typeof value === 'string' ? value : null; }
function nullableNumber(value: unknown): number | null { return typeof value === 'number' && Number.isFinite(value) ? value : null; }
function nullableBoolean(value: unknown): boolean | null { return typeof value === 'boolean' ? value : null; }

function parseAuthorizedResources(value: unknown, expectedKind: ResourceKind, expectedMode: 'view' | 'download'): AuthorizedResource[] | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const payload = value as Record<string, unknown>;
  if (payload.ok !== true || payload.kind !== expectedKind || payload.disposition !== expectedMode || !Array.isArray(payload.resources)) return null;
  const resources = payload.resources.flatMap((item): AuthorizedResource[] => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const row = item as Record<string, unknown>;
    if (typeof row.url !== 'string') return [];
    try {
      const url = new URL(row.url);
      return url.protocol === 'https:' ? [{ url: url.toString(), filename: typeof row.filename === 'string' ? row.filename : 'arquivo' }] : [];
    } catch { return []; }
  });
  return resources.length ? resources : null;
}

function formatDate(value: string | null) {
  if (!value) return 'Data não informada';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Data não informada' : date.toLocaleString('pt-BR');
}

function label(value: string) {
  return value.replace(/_/g, ' ').replace(/^./, (letter) => letter.toLocaleUpperCase('pt-BR'));
}
