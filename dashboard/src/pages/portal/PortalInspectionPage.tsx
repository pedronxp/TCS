import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Download, FileText, MapPin, RefreshCw } from 'lucide-react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { portalHome } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

interface InspectionDetail {
  id: string;
  protocol: string;
  status: string;
  risk_level: string | null;
  score: number | null;
  occurred_at: string | null;
  address: string | null;
  municipality: string | null;
  agent_name: string | null;
  latitude: number | null;
  longitude: number | null;
  document_available: boolean;
}

interface AuthorizedDocument {
  inspectionId: string;
  mode: 'view' | 'download';
  url: string;
}

export function PortalInspectionPage() {
  const { inspectionId } = useParams();
  const [searchParams] = useSearchParams();
  const { access } = usePortalAuth();
  const [documentError, setDocumentError] = useState<string | null>(null);
  const [documentMode, setDocumentMode] = useState<'view' | 'download' | null>(null);
  const [authorizedDocument, setAuthorizedDocument] = useState<AuthorizedDocument | null>(null);
  const query = useQuery({
    queryKey: ['portal', 'inspection', inspectionId, access?.userId, access?.accountKind, access?.organizationId, access?.role],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('portal_get_inspection', { p_inspection_id: inspectionId ?? '' });
      if (error || !isInspectionDetail(data)) throw new Error(error?.message ?? 'inspection_not_found');
      return data;
    },
    enabled: Boolean(inspectionId && access),
  });
  if (!access) return null;
  const root = portalHome(access.accountKind);
  const returnDestination = safeReturnDestination(searchParams.get('returnTo'), root);

  async function openDocument(mode: 'view' | 'download') {
    if (!inspectionId || documentMode) return;
    setDocumentError(null);
    setAuthorizedDocument(null);
    setDocumentMode(mode);
    try {
      const { data, error } = await supabase.functions.invoke('portal-inspection-document', {
        body: { inspection_id: inspectionId, mode },
      });
      const signedUrl = secureSignedUrl(data, mode);
      if (error || !signedUrl) throw new Error('document_not_authorized');
      setAuthorizedDocument({ inspectionId, mode, url: signedUrl });
    } catch {
      setDocumentError('Não foi possível autorizar o documento. Tente novamente.');
    } finally {
      setDocumentMode(null);
    }
  }

  if (query.isLoading) return <InspectionSkeleton />;
  if (query.isError || !query.data) {
    return (
      <Card>
        <CardContent className="grid min-h-72 place-items-center p-8 text-center" role="alert">
          <div>
            <h1 className="text-xl font-semibold">Vistoria indisponível</h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">O registro pode não existir ou estar fora do seu escopo autorizado.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={() => void query.refetch()}><RefreshCw aria-hidden="true" />Tentar novamente</Button>
              <Button asChild><Link to={returnDestination.path}>{returnDestination.label}</Link></Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  const inspection = query.data;
  const canReadDocument = access.permissions.includes('document.read');

  return (
    <div className="page-stack">
      <header>
        <Button asChild variant="ghost" className="-ml-3"><Link to={returnDestination.path}><ArrowLeft aria-hidden="true" />{returnDestination.label}</Link></Button>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-[-0.025em]">{inspection.protocol}</h1>
          <Badge>{humanize(inspection.status)}</Badge>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">{formatDate(inspection.occurred_at)}</p>
      </header>

      <section className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle>Resumo técnico</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Info label="Risco" value={inspection.risk_level ? humanize(inspection.risk_level) : 'Não classificado'} />
            <Info label="Pontuação" value={inspection.score?.toLocaleString('pt-BR') ?? '—'} />
            <Info label="Responsável" value={inspection.agent_name ?? 'Não informado'} />
            <Info label="Município" value={inspection.municipality ?? 'Não informado'} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Laudo</CardTitle></CardHeader>
          <CardContent>
            {!canReadDocument ? (
              <p className="text-sm leading-6 text-muted-foreground">Seu perfil pode consultar a vistoria, mas não possui permissão para acessar o laudo.</p>
            ) : inspection.document_available ? (
              <div className="space-y-4">
                <p className="flex items-center gap-2 text-sm"><FileText className="text-primary" aria-hidden="true" />Laudo disponível por link temporário</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void openDocument('view')} disabled={documentMode !== null}>{documentMode === 'view' ? 'Autorizando…' : 'Visualizar laudo'}</Button>
                  <Button variant="outline" onClick={() => void openDocument('download')} disabled={documentMode !== null}><Download aria-hidden="true" />{documentMode === 'download' ? 'Autorizando…' : 'Baixar arquivo'}</Button>
                </div>
                {authorizedDocument && authorizedDocument.inspectionId === inspectionId && (
                  <div className="rounded-md border border-success/30 bg-success-soft p-3" role="status">
                    <p className="text-sm">Link temporário autorizado. Abra-o em uma nova aba para manter esta vistoria disponível.</p>
                    <Button asChild className="mt-3" size="sm">
                      <a href={authorizedDocument.url} target="_blank" rel="noopener noreferrer">
                        {authorizedDocument.mode === 'download' ? 'Baixar arquivo autorizado' : 'Abrir laudo autorizado'}
                      </a>
                    </Button>
                  </div>
                )}
              </div>
            ) : <p className="text-sm leading-6 text-muted-foreground">O laudo ainda não foi disponibilizado para esta vistoria.</p>}
            {documentError && <p className="mt-3 text-sm text-destructive" role="alert">{documentError}</p>}
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><MapPin aria-hidden="true" />Localização</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm">{inspection.address ?? 'Endereço não informado'}</p>
          {inspection.latitude !== null && inspection.longitude !== null && <p className="mt-2 text-xs tabular-nums text-muted-foreground">{inspection.latitude.toFixed(6)}, {inspection.longitude.toFixed(6)}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

function InspectionSkeleton() {
  return (
    <div className="space-y-4" role="status" aria-label="Carregando vistoria">
      <span className="sr-only">Carregando vistoria…</span>
      <Skeleton className="h-10 w-72 motion-reduce:animate-none" />
      <Skeleton className="h-72 w-full motion-reduce:animate-none" />
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-md bg-secondary p-4"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-sm font-semibold">{value}</p></div>;
}

function isInspectionDetail(value: unknown): value is InspectionDetail {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const item = value as Record<string, unknown>;
  return nonEmptyString(item.id)
    && nonEmptyString(item.protocol)
    && nonEmptyString(item.status)
    && nullableString(item.risk_level)
    && nullableFiniteNumber(item.score)
    && nullableString(item.occurred_at)
    && nullableString(item.address)
    && nullableString(item.municipality)
    && nullableString(item.agent_name)
    && nullableCoordinate(item.latitude, -90, 90)
    && nullableCoordinate(item.longitude, -180, 180)
    && (item.document_available === true || item.document_available === false);
}

function secureSignedUrl(value: unknown, expectedMode: 'view' | 'download') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  const candidate = response.signed_url;
  if (response.ok !== true || response.disposition !== expectedMode || typeof candidate !== 'string') return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function nullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string';
}

function nullableFiniteNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value));
}

function nullableCoordinate(value: unknown, minimum: number, maximum: number): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum);
}

function safeReturnDestination(candidate: string | null, root: string) {
  const fallback = { path: `${root}/vistorias`, label: 'Vistorias' };
  if (!candidate) return fallback;
  try {
    const url = new URL(candidate, 'https://portal.tcs.local');
    if (url.origin !== 'https://portal.tcs.local') return fallback;
    const labels: Record<string, string> = {
      [`${root}/vistorias`]: 'Vistorias',
      [`${root}/documentos`]: 'Documentos',
      [`${root}/mapa`]: 'Voltar ao mapa',
      [`${root}/agenda`]: 'Voltar à agenda',
    };
    const label = labels[url.pathname];
    return label ? { path: `${url.pathname}${url.search}`, label } : fallback;
  } catch {
    return fallback;
  }
}

function formatDate(value: string | null) {
  if (!value) return 'Data não informada';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Data não informada' : parsed.toLocaleString('pt-BR');
}

function humanize(value: string) {
  const normalized = value.replace(/_/g, ' ');
  return normalized.charAt(0).toLocaleUpperCase('pt-BR') + normalized.slice(1);
}
