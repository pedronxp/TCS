import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  Download,
  Eye,
  FileCheck2,
  Link2,
  LoaderCircle,
  MonitorUp,
  RefreshCw,
  Send,
  X,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace, portalRestrictionMessage } from '@/lib/portal';
import { buildAcknowledgementUrl, parseAcknowledgementLinkResult } from '@/lib/documentAcknowledgementLinks';
import { supabase } from '@/lib/supabase';

type AcknowledgementStatus = 'pending' | 'link_sent' | 'acknowledged' | 'refused' | 'unable_to_sign';

type AcknowledgementItem = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  statusLabel?: string;
  link_url?: string;
  inspection_protocol?: string;
  recipient_name?: string;
  recipient_relationship?: string;
  created_at?: string;
  expires_at?: string;
  outcome?: string;
  reason?: string;
  can_resume?: boolean;
  can_generate?: boolean;
  can_revoke?: boolean;
  can_copy?: boolean;
  acknowledgement_id?: string;
  document_available?: boolean;
  signature_available?: boolean;
  acknowledged_at?: string;
};

type EvidenceAsset = 'document' | 'signature';
type AuthorizedEvidence = { eventId: string; asset: EvidenceAsset; mode: 'view' | 'download'; url: string };

const statusMeta: Record<AcknowledgementStatus, { label: string; tone: 'warning' | 'success' | 'destructive' | 'outline'; icon: typeof Clock }> = {
  pending: { label: 'Pendente', tone: 'warning', icon: Clock },
  link_sent: { label: 'Link enviado', tone: 'outline', icon: Send },
  acknowledged: { label: 'Concluída', tone: 'success', icon: CheckCircle2 },
  refused: { label: 'Recusada', tone: 'destructive', icon: XCircle },
  unable_to_sign: { label: 'Impossível assinar', tone: 'destructive', icon: AlertCircle },
};

function resolveStatus(raw: string): AcknowledgementStatus {
  const normalized = raw.toLocaleLowerCase('pt-BR').replace(/-/g, '_');
  if (normalized in statusMeta) return normalized as AcknowledgementStatus;
  if (normalized.includes('pend') || normalized.includes('aguard')) return 'pending';
  if (normalized.includes('envi') || normalized.includes('sent')) return 'link_sent';
  if (normalized.includes('ack') || normalized.includes('concl') || normalized.includes('assin') && !normalized.includes('imposs')) return 'acknowledged';
  if (normalized.includes('recus') || normalized.includes('refus')) return 'refused';
  if (normalized.includes('imposs') || normalized.includes('unable')) return 'unable_to_sign';
  return 'pending';
}

export function PortalAcknowledgementsPage() {
  const { access } = usePortalAuth();
  const query = useQuery({
    queryKey: ['portal', 'workspace', 'ciencias', access?.userId, access?.accountKind, access?.organizationId ?? null],
    queryFn: () => fetchPortalWorkspace('ciencias'),
    enabled: Boolean(access),
  });
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [evidenceBusy, setEvidenceBusy] = useState<string | null>(null);
  const [authorizedEvidence, setAuthorizedEvidence] = useState<AuthorizedEvidence | null>(null);
  const [issuedLinks, setIssuedLinks] = useState<Record<string, { url: string; expiresAt: string }>>({});
  const subscriptionBlocks = access ? !access.creationAllowed : false;
  const items = (query.data?.items ?? []) as AcknowledgementItem[];

  function setActionError(message: string) {
    setError(message);
    setNotice(null);
  }

  async function runLinkAction(item: AcknowledgementItem, action: 'generate' | 'revoke' | 'collect') {
    const collectionWindow = action === 'collect' ? window.open('about:blank', '_blank') : null;
    if (collectionWindow) collectionWindow.opener = null;
    setError(null);
    setNotice(null);
    setBusy(`${action}-${String(item.id)}`);
    try {
      if (action === 'collect' && !collectionWindow) throw new Error('popup_blocked');
      const rpc = supabase.rpc as unknown as (
        name: string,
        args: Record<string, unknown>,
      ) => Promise<{ data: unknown; error: { message?: string } | null }>;
      if (action === 'revoke') {
        const { data, error: rpcError } = await rpc('portal_revoke_document_acknowledgement_link', {
          p_document_id: item.id,
        });
        if (rpcError || !isSuccessfulRevocation(data)) throw new Error(rpcError?.message || 'revoke_failed');
        setIssuedLinks((current) => {
          const next = { ...current };
          delete next[item.id];
          return next;
        });
        setNotice('Link de ciência revogado. Ele não pode mais abrir o documento nem registrar resultado.');
        await query.refetch();
        return;
      }

      const { data, error: rpcError } = await rpc('portal_create_document_acknowledgement_link', {
        p_document_id: item.id,
        p_expires_in_hours: 72,
      });
      const result = parseAcknowledgementLinkResult(data);
      if (rpcError || !result) throw new Error(rpcError?.message || 'link_creation_failed');
      const url = buildAcknowledgementUrl(result.token, window.location.origin);
      setIssuedLinks((current) => ({ ...current, [item.id]: { url, expiresAt: result.expiresAt } }));

      if (action === 'collect') {
        collectionWindow!.location.href = url;
        setNotice('Coleta aberta em uma nova aba. O destinatário deve ler o documento e registrar o próprio resultado.');
      } else {
        try {
          await navigator.clipboard.writeText(url);
          setNotice(`Link remoto criado e copiado. Validade: ${formatExpiry(result.expiresAt)}.`);
        } catch {
          setNotice(`Link remoto criado. Copie-o na linha do documento. Validade: ${formatExpiry(result.expiresAt)}.`);
        }
      }
    } catch (actionError) {
      collectionWindow?.close();
      setActionError(linkActionErrorMessage(actionError));
    } finally {
      setBusy(null);
    }
  }

  async function copyLink(item: AcknowledgementItem) {
    if (!item.link_url) return;
    setBusy(`copy-${String(item.id)}`);
    try {
      await navigator.clipboard.writeText(item.link_url);
      setNotice(`Link de ciência copiado: ${item.link_url}`);
      setError(null);
    } catch {
      setActionError('Não foi possível copiar o link. Copie manualmente da lista.');
    } finally {
      setBusy(null);
    }
  }

  async function openEvidence(item: AcknowledgementItem, asset: EvidenceAsset, mode: 'view' | 'download') {
    const eventId = item.acknowledgement_id;
    if (!eventId || evidenceBusy) return;
    setError(null);
    setAuthorizedEvidence(null);
    const action = `${eventId}-${asset}-${mode}`;
    setEvidenceBusy(action);
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('portal-acknowledgement-document', {
        body: { event_id: eventId, asset, mode },
      });
      const url = secureEvidenceUrl(data, asset, mode);
      if (invokeError || !url) throw new Error('evidence_not_authorized');
      setAuthorizedEvidence({ eventId, asset, mode, url });
    } catch {
      setError('Não foi possível autorizar esta evidência. Tente novamente.');
    } finally {
      setEvidenceBusy(null);
    }
  }

  return (
    <div className="page-stack">
      {subscriptionBlocks && (
        <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-foreground" role="status">
          A gestão de ciências está em consulta: {portalRestrictionMessage(access?.restrictionCause ?? null)} Novas emissões de link voltam após a regularização da assinatura.
        </p>
      )}
      <p className="rounded-md border border-border bg-secondary p-3 text-sm text-muted-foreground" role="status">
        Acompanhe o recebimento de documentos pela população. Cada ciência registra Pendente, Link enviado, Concluída, Recusada ou impossibilidade de assinar.
      </p>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Operação</p>
        <h1 className="mt-2 text-3xl font-semibold">Ciências</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Emita links externos de recebimento, copie e revogue links abertos e retome ciências interrompidas. Documentos já concluídos não recebem novo link.
        </p>
      </header>

      {notice && <p className="rounded-md border border-success/30 bg-success-soft p-3 text-sm text-foreground" role="status">{notice}</p>}
      {error && <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-foreground" role="alert">{error}</p>}

      <Card aria-busy={query.isLoading}>
        <CardHeader className="min-h-[72px] gap-3 border-b sm:flex-row sm:items-center sm:justify-between">
          <div>
            <CardTitle className="text-lg">Ciências do escopo</CardTitle>
            <p className="mt-1 min-h-4 text-xs text-muted-foreground" aria-live="polite">
              {query.isFetching && !query.isLoading ? 'Atualizando dados sem alterar sua posição…' : ''}
            </p>
          </div>
          {query.isError && (
            <Button variant="outline" size="sm" onClick={() => void query.refetch()}><RefreshCw aria-hidden="true" />Tentar novamente</Button>
          )}
        </CardHeader>
        <CardContent className="p-0">
          {query.isLoading && (
            <div className="space-y-3 p-6" role="status" aria-label="Carregando ciências">
              <span className="sr-only">Carregando ciências…</span>
              <div className="h-20 animate-pulse rounded-md bg-secondary motion-reduce:animate-none" />
              <div className="h-20 animate-pulse rounded-md bg-secondary motion-reduce:animate-none" />
            </div>
          )}
          {query.isError && (
            <div className="grid min-h-64 place-items-center p-8 text-center" role="alert">
              <div>
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-secondary text-primary"><AlertCircle aria-hidden="true" /></span>
                <h2 className="mt-4 font-semibold">Não foi possível carregar as ciências</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Nenhum dado foi estimado ou substituído. Tente novamente.</p>
                <Button className="mt-4" variant="outline" onClick={() => void query.refetch()}><RefreshCw aria-hidden="true" />Tentar novamente</Button>
              </div>
            </div>
          )}
          {query.data && items.length === 0 && (
            <div className="grid min-h-64 place-items-center p-8 text-center">
              <div>
                <span className="mx-auto grid h-10 w-10 place-items-center rounded-full bg-secondary text-primary"><FileCheck2 className="h-5 w-5" aria-hidden="true" /></span>
                <h2 className="mt-4 font-semibold">Nenhuma ciência registrada</h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">Quando houver documentos para recebimento pela população, eles aparecerão aqui.</p>
              </div>
            </div>
          )}
          {query.data && items.length > 0 && (
            <ul className="divide-y divide-border">
              {items.map((item, index) => {
                const issued = issuedLinks[item.id];
                const displayItem = issued ? {
                  ...item,
                  status: 'link_sent',
                  link_url: issued.url,
                  expires_at: issued.expiresAt,
                  can_revoke: true,
                } : item;
                return (
                <AcknowledgementRow
                  key={String(item.id ?? index)}
                  item={displayItem}
                  busy={busy}
                  creationDisabled={subscriptionBlocks}
                  onGenerate={() => void runLinkAction(item, 'generate')}
                  onRevoke={() => void runLinkAction(item, 'revoke')}
                  onCollect={() => void runLinkAction(item, 'collect')}
                  onCopy={() => void copyLink(displayItem)}
                  evidenceBusy={evidenceBusy}
                  authorizedEvidence={authorizedEvidence}
                  onEvidence={(asset, mode) => void openEvidence(item, asset, mode)}
                />
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function AcknowledgementRow({
  item,
  busy,
  creationDisabled,
  onGenerate,
  onRevoke,
  onCollect,
  onCopy,
  evidenceBusy,
  authorizedEvidence,
  onEvidence,
}: {
  item: AcknowledgementItem;
  busy: string | null;
  creationDisabled: boolean;
  onGenerate: () => void;
  onRevoke: () => void;
  onCollect: () => void;
  onCopy: () => void;
  evidenceBusy: string | null;
  authorizedEvidence: AuthorizedEvidence | null;
  onEvidence: (asset: EvidenceAsset, mode: 'view' | 'download') => void;
}) {
  const status = resolveStatus(String(item.status ?? 'pending'));
  const meta = statusMeta[status];
  const Icon = meta.icon;
  const title = String(item.title ?? item.inspection_protocol ?? `Ciência ${item.id}`);
  const subtitle = String(item.subtitle ?? item.recipient_name ?? item.recipient_relationship ?? 'Destinatário não informado');
  const concluded = status === 'acknowledged';
  const finalOutcome = status === 'refused' || status === 'unable_to_sign';
  const id = String(item.id);
  const eventId = item.acknowledgement_id;
  const evidenceAction = (asset: EvidenceAsset, mode: 'view' | 'download') => `${eventId}-${asset}-${mode}`;

  return (
    <li className="grid gap-3 px-6 py-5 text-sm sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate font-semibold">{title}</p>
          <Badge variant={meta.tone} className="gap-1"><Icon className="h-3.5 w-3.5" aria-hidden="true" />{item.statusLabel ?? meta.label}</Badge>
        </div>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{subtitle}</p>
        {item.link_url && (
          <p className="mt-2 break-all text-xs text-muted-foreground">Link: <span className="font-mono">{item.link_url}</span></p>
        )}
        {item.reason && (
          <p className="mt-2 rounded-md border bg-secondary p-2 text-xs leading-5 text-muted-foreground">Motivo: {item.reason}</p>
        )}
        {eventId && item.document_available && (
          <div className="mt-3 rounded-lg border bg-secondary/50 p-3">
            <p className="text-xs font-bold">Evidências da ciência</p>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">Os arquivos são liberados por link temporário, somente para usuários autorizados.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => onEvidence('document', 'view')} disabled={Boolean(evidenceBusy)}>{evidenceBusy === evidenceAction('document', 'view') ? 'Autorizando…' : <><Eye aria-hidden="true" />Visualizar documento</>}</Button>
              <Button variant="ghost" size="sm" onClick={() => onEvidence('document', 'download')} disabled={Boolean(evidenceBusy)}>{evidenceBusy === evidenceAction('document', 'download') ? 'Autorizando…' : <><Download aria-hidden="true" />Baixar documento</>}</Button>
              {item.signature_available && <Button variant="outline" size="sm" onClick={() => onEvidence('signature', 'view')} disabled={Boolean(evidenceBusy)}>{evidenceBusy === evidenceAction('signature', 'view') ? 'Autorizando…' : <><Eye aria-hidden="true" />Visualizar assinatura</>}</Button>}
              {item.signature_available && <Button variant="ghost" size="sm" onClick={() => onEvidence('signature', 'download')} disabled={Boolean(evidenceBusy)}>{evidenceBusy === evidenceAction('signature', 'download') ? 'Autorizando…' : <><Download aria-hidden="true" />Baixar assinatura</>}</Button>}
            </div>
            {authorizedEvidence?.eventId === eventId && authorizedEvidence.asset === 'signature' && authorizedEvidence.mode === 'view' && <SignaturePreview url={authorizedEvidence.url} />}
            {authorizedEvidence?.eventId === eventId && (
              <Button asChild size="sm" className="mt-3"><a href={authorizedEvidence.url} target="_blank" rel="noopener noreferrer">{authorizedEvidence.mode === 'download' ? 'Baixar arquivo autorizado' : 'Abrir arquivo autorizado'}</a></Button>
            )}
          </div>
        )}
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {!concluded && !finalOutcome && (item.can_resume ?? true) && (
          <Button variant="outline" size="sm" onClick={onCollect} disabled={Boolean(busy) || creationDisabled} title={creationDisabled ? portalRestrictionCause(creationDisabled) : 'Abrir coleta presencial em uma nova aba'}>
            {busy === `collect-${id}` ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <MonitorUp aria-hidden="true" />}Coletar pela web
          </Button>
        )}
        {!concluded && !finalOutcome && (item.can_generate ?? true) && (
          <Button variant="outline" size="sm" onClick={onGenerate} disabled={Boolean(busy) || creationDisabled} title={creationDisabled ? portalRestrictionCause(creationDisabled) : 'Gerar link externo de recebimento'}>
            {busy === `generate-${id}` ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Link2 aria-hidden="true" />}Gerar link externo
          </Button>
        )}
        {item.link_url && (item.can_copy ?? true) && (
          <Button variant="ghost" size="sm" onClick={onCopy} disabled={Boolean(busy)}>
            {busy === `copy-${id}` ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Copy aria-hidden="true" />}Copiar link
          </Button>
        )}
        {!concluded && !finalOutcome && item.can_revoke === true && (
          <Button variant="outline" size="sm" onClick={onRevoke} disabled={Boolean(busy)} title="Revogar link aberto">
            {busy === `revoke-${id}` ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <X aria-hidden="true" />}Revogar link
          </Button>
        )}
        {concluded && null}
        {finalOutcome && <span className="max-w-56 text-xs leading-5 text-muted-foreground">Para outra apresentação, gere uma nova versão do documento.</span>}
      </div>
    </li>
  );
}

function isSuccessfulRevocation(value: unknown) {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>).ok === true);
}

function formatExpiry(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

function linkActionErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/popup_blocked/i.test(message)) {
    return 'O navegador bloqueou a nova aba. Permita pop-ups para este portal e tente novamente.';
  }
  if (/creation_not_allowed|subscription|document_link_creation_not_allowed/i.test(message)) {
    return 'A assinatura ou sua permissão não permite emitir um novo link neste momento.';
  }
  if (/already_finalized|already_acknowledged/i.test(message)) {
    return 'Esta versão já possui um resultado final. Gere uma nova versão para realizar outra apresentação.';
  }
  if (/scope|permission|not_allowed|denied/i.test(message)) {
    return 'Sua sessão não possui permissão sobre este documento.';
  }
  return 'Não foi possível concluir a ação de ciência. Atualize a página e tente novamente.';
}

function secureEvidenceUrl(value: unknown, asset: EvidenceAsset, mode: 'view' | 'download') {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const response = value as Record<string, unknown>;
  if (response.ok !== true || response.asset !== asset || response.disposition !== mode || typeof response.signed_url !== 'string') return null;
  try {
    const url = new URL(response.signed_url);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

type SignatureStroke = { points: Array<{ x: number; y: number }> };

function SignaturePreview({ url }: { url: string }) {
  const [strokes, setStrokes] = useState<SignatureStroke[] | null>(null);
  useEffect(() => {
    let active = true;
    setStrokes(null);
    void fetch(url)
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('signature_unavailable')))
      .then((value: unknown) => {
        if (active) setStrokes(parseSignatureStrokes(value));
      })
      .catch(() => { if (active) setStrokes([]); });
    return () => { active = false; };
  }, [url]);
  if (strokes === null) return <p className="mt-3 text-xs text-muted-foreground">Carregando assinatura…</p>;
  if (!strokes.length) return <p className="mt-3 text-xs text-muted-foreground">Não foi possível renderizar a assinatura. Use o download para acessar a evidência original.</p>;
  return <div className="mt-3 overflow-hidden rounded-lg border bg-card p-2"><p className="mb-2 text-xs font-medium">Assinatura capturada</p><svg viewBox="0 0 600 200" className="h-32 w-full rounded bg-white" role="img" aria-label="Assinatura capturada"><title>Assinatura capturada</title>{strokes.map((stroke, index) => <polyline key={index} points={stroke.points.map((point) => `${point.x * 600},${point.y * 200}`).join(' ')} fill="none" stroke="#172033" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />)}</svg></div>;
}

function parseSignatureStrokes(value: unknown): SignatureStroke[] {
  if (!Array.isArray(value)) return [];
  return value.map((stroke) => {
    if (!stroke || typeof stroke !== 'object' || Array.isArray(stroke)) return null;
    const points = (stroke as { points?: unknown }).points;
    if (!Array.isArray(points)) return null;
    const valid = points.filter((point): point is { x: number; y: number } => Boolean(point) && typeof point === 'object' && !Array.isArray(point) && Number.isFinite((point as { x?: unknown }).x) && Number.isFinite((point as { y?: unknown }).y) && (point as { x: number }).x >= 0 && (point as { x: number }).x <= 1 && (point as { y: number }).y >= 0 && (point as { y: number }).y <= 1);
    return valid.length ? { points: valid } : null;
  }).filter((stroke): stroke is SignatureStroke => stroke !== null);
}

function portalRestrictionCause(blocked: boolean) {
  return blocked ? 'A assinatura não permite novas operações no momento.' : undefined;
}

export { statusMeta, resolveStatus };
