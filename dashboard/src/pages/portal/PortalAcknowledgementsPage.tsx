import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Copy,
  ExternalLink,
  FileCheck2,
  Link2,
  LoaderCircle,
  RefreshCw,
  Send,
  Undo2,
  X,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace, portalRestrictionMessage } from '@/lib/portal';

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
};

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
  const subscriptionBlocks = access ? !access.creationAllowed : false;
  const items = (query.data?.items ?? []) as AcknowledgementItem[];

  function setActionError(message: string) {
    setError(message);
    setNotice(null);
  }

  async function runLinkAction(item: AcknowledgementItem, action: 'generate' | 'revoke' | 'new') {
    setError(null);
    setNotice(null);
    setBusy(`${action}-${String(item.id)}`);
    // Ações de geração/revogação de link dependem de contrato de ciência municipal ainda indisponível.
    // Estado visual mantém a intenção e registra a pendência no relatório final.
    window.setTimeout(() => {
      setBusy(null);
      setActionError('A geração e revogação de links de ciência ainda não estão disponíveis no backend. Solicite o endpoint no relatório de pendências.');
    }, 0);
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
              {items.map((item, index) => (
                <AcknowledgementRow
                  key={String(item.id ?? index)}
                  item={item}
                  busy={busy}
                  disabled={subscriptionBlocks}
                  onGenerate={() => void runLinkAction(item, 'generate')}
                  onRevoke={() => void runLinkAction(item, 'revoke')}
                  onNewLink={() => void runLinkAction(item, 'new')}
                  onResume={() => void runLinkAction(item, 'generate')}
                  onCopy={() => void copyLink(item)}
                />
              ))}
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
  disabled,
  onGenerate,
  onRevoke,
  onNewLink,
  onResume,
  onCopy,
}: {
  item: AcknowledgementItem;
  busy: string | null;
  disabled: boolean;
  onGenerate: () => void;
  onRevoke: () => void;
  onNewLink: () => void;
  onResume: () => void;
  onCopy: () => void;
}) {
  const status = resolveStatus(String(item.status ?? 'pending'));
  const meta = statusMeta[status];
  const Icon = meta.icon;
  const title = String(item.title ?? item.inspection_protocol ?? `Ciência ${item.id}`);
  const subtitle = String(item.subtitle ?? item.recipient_name ?? item.recipient_relationship ?? 'Destinatário não informado');
  const concluded = status === 'acknowledged';
  const revoked = status === 'refused' || status === 'unable_to_sign';
  const id = String(item.id);

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
      </div>
      <div className="flex flex-wrap gap-2 sm:justify-end">
        {!concluded && !revoked && (item.can_resume ?? true) && (
          <Button variant="outline" size="sm" onClick={onResume} disabled={Boolean(busy) || disabled} title={disabled ? portalRestrictionCause(disabled) : 'Retomar ciência interrompida'}>
            {busy === `generate-${id}` ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Undo2 aria-hidden="true" />}Retomar ciência
          </Button>
        )}
        {!concluded && !revoked && (item.can_generate ?? true) && (
          <Button variant="outline" size="sm" onClick={onGenerate} disabled={Boolean(busy) || disabled} title={disabled ? portalRestrictionCause(disabled) : 'Gerar link externo de recebimento'}>
            {busy === `generate-${id}` ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Link2 aria-hidden="true" />}Gerar link externo
          </Button>
        )}
        {item.link_url && status !== 'pending' && (item.can_copy ?? true) && (
          <Button variant="ghost" size="sm" onClick={onCopy} disabled={Boolean(busy)}>
            {busy === `copy-${id}` ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Copy aria-hidden="true" />}Copiar link
          </Button>
        )}
        {item.link_url && !concluded && !revoked && (item.can_revoke ?? true) && (
          <Button variant="outline" size="sm" onClick={onRevoke} disabled={Boolean(busy) || disabled} title={disabled ? portalRestrictionCause(disabled) : 'Revogar link aberto'}>
            {busy === `revoke-${id}` ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <X aria-hidden="true" />}Revogar link
          </Button>
        )}
        {concluded && (
          <Button variant="ghost" size="sm" onClick={onNewLink} disabled={Boolean(busy)} title="Emitir novo link para o mesmo documento">
            {busy === `new-${id}` ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <Send aria-hidden="true" />}Emitir novo link
          </Button>
        )}
        {revoked && (
          <Button variant="outline" size="sm" onClick={onNewLink} disabled={Boolean(busy)} title="Emitir novo link para tentar novamente">
            {busy === `new-${id}` ? <LoaderCircle className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <ExternalLink aria-hidden="true" />}Emitir novo link
          </Button>
        )}
      </div>
    </li>
  );
}

function portalRestrictionCause(blocked: boolean) {
  return blocked ? 'A assinatura não permite novas operações no momento.' : undefined;
}

export { statusMeta, resolveStatus };
