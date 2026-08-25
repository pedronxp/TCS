import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AlertCircle, Building2, CalendarClock, CheckCircle2, LoaderCircle, Mail, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Checkbox } from '@/components/ui/Checkbox';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/Card';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { supabase } from '@/lib/supabase';

type InvitePreview = {
  organization_name?: string;
  email_hint?: string;
  role?: string;
  expires_at?: string;
  status?: string;
};

type InviteState =
  | { kind: 'loading' }
  | { kind: 'ready'; preview: InvitePreview }
  | { kind: 'accepting'; preview: InvitePreview }
  | { kind: 'invalid' }
  | { kind: 'expired' }
  | { kind: 'used' }
  | { kind: 'revoked' }
  | { kind: 'error'; preview: InvitePreview; message: string }
  | { kind: 'success'; preview: InvitePreview; accessRefreshFailed: boolean; importedInspections: number };

type PortalRpc = (
  name: string,
  args: Record<string, unknown>,
) => PromiseLike<{ data: unknown; error: { message: string } | null }>;

const stateCopy = {
  invalid: {
    title: 'Convite inválido',
    text: 'O endereço não identifica um convite disponível. Confira o link recebido ou solicite um novo ao administrador.',
  },
  expired: {
    title: 'Convite expirado',
    text: 'O prazo deste convite terminou. Solicite um novo ao administrador da organização.',
  },
  used: {
    title: 'Convite já utilizado',
    text: 'Este vínculo já foi concluído ou encerrado e não pode ser aceito novamente.',
  },
  revoked: {
    title: 'Convite revogado',
    text: 'Este convite foi encerrado pelo administrador da organização. Solicite um novo convite para continuar.',
  },
} as const;

export function InviteAcceptancePage() {
  const { token } = useParams();
  const { session, refreshAccess } = usePortalAuth();
  const navigate = useNavigate();
  const [state, setState] = useState<InviteState>({ kind: 'loading' });
  const [history, setHistory] = useState<{ count: number; firstAt: string | null; lastAt: string | null } | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyChecked, setHistoryChecked] = useState(false);
  const [importHistory, setImportHistory] = useState(false);

  useEffect(() => {
    let active = true;
    if (!token) {
      setState({ kind: 'invalid' });
      return () => { active = false; };
    }
    setState({ kind: 'loading' });
    const portalRpc = supabase.rpc.bind(supabase) as unknown as PortalRpc;
    void portalRpc('portal_get_invite_preview', { p_token: token }).then(({ data, error }) => {
      if (!active) return;
      if (error || !data || typeof data !== 'object' || Array.isArray(data)) {
        setState({ kind: 'invalid' });
        return;
      }
      const preview = data as InvitePreview;
      if (preview.status === 'expired') setState({ kind: 'expired' });
      else if (preview.status === 'accepted' || preview.status === 'already_used') setState({ kind: 'used' });
      else if (preview.status === 'revoked') setState({ kind: 'revoked' });
      else if (preview.status !== 'pending') setState({ kind: 'invalid' });
      else setState({ kind: 'ready', preview });
    });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!session || !['ready', 'error'].includes(state.kind) || historyChecked || historyLoading) return;
    setHistoryLoading(true);
    setHistoryChecked(true);
    const portalRpc = supabase.rpc.bind(supabase) as unknown as PortalRpc;
    void portalRpc('preview_individual_inspection_import', { p_user_id: null }).then(({ data, error }) => {
      setHistoryLoading(false);
      if (error || !data || typeof data !== 'object' || Array.isArray(data)) return;
      const value = data as { count?: number; first_at?: string; last_at?: string };
      setHistory({ count: Number(value.count ?? 0), firstAt: value.first_at ?? null, lastAt: value.last_at ?? null });
    });
  }, [historyChecked, historyLoading, session, state.kind]);

  async function accept(preview: InvitePreview) {
    if (!token) return;
    setState({ kind: 'accepting', preview });
    const portalRpc = supabase.rpc.bind(supabase) as unknown as PortalRpc;
    try {
      const { data, error } = await portalRpc('portal_accept_organization_invite_with_history', {
        p_token: token,
        p_import_individual_inspections: importHistory,
      });
      if (error) {
        setState({
          kind: 'error',
          preview,
          message: error.message.includes('email_mismatch')
            ? 'Entre com o mesmo e-mail verificado que recebeu o convite.'
            : 'Não foi possível aceitar este convite. Tente novamente.',
        });
        return;
      }
      const result = data && typeof data === 'object' && !Array.isArray(data)
        ? data as { accepted?: boolean; reason?: string; imported_inspections?: number }
        : null;
      if (result?.accepted !== true) {
        if (result?.reason === 'expired') setState({ kind: 'expired' });
        else if (result?.reason === 'already_used') setState({ kind: 'used' });
        else if (result?.reason === 'invalid') setState({ kind: 'invalid' });
        else setState({ kind: 'error', preview, message: acceptanceFailureMessage(result?.reason) });
        return;
      }
      let accessRefreshFailed = false;
      try {
        await refreshAccess();
      } catch {
        accessRefreshFailed = true;
      }
      setState({ kind: 'success', preview, accessRefreshFailed, importedInspections: Number(result.imported_inspections ?? 0) });
    } catch {
      setState({ kind: 'error', preview, message: 'Não foi possível aceitar este convite. Tente novamente.' });
    }
  }

  const preview = 'preview' in state ? state.preview : null;
  const isWorking = state.kind === 'accepting';

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-4 sm:p-8">
      <Card className="w-full max-w-xl overflow-hidden">
        <CardHeader className="border-b bg-card p-6 sm:p-8">
          <div className="flex items-start gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary" aria-hidden="true">
              <ShieldCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Acesso municipal</p>
              <h1 className="mt-2 text-2xl font-semibold tracking-[-0.02em]">Confirme o convite antes de entrar</h1>
              <CardDescription className="mt-2 leading-6">O vínculo só é criado depois da validação do convite e do e-mail autenticado.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5 p-6 sm:p-8" aria-live="polite">
          {state.kind === 'loading' && (
            <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground" role="status">
              <LoaderCircle className="h-5 w-5 animate-spin motion-reduce:animate-none" aria-hidden="true" />
              Validando convite seguro…
            </div>
          )}

          {preview && state.kind !== 'success' && <InviteDetails preview={preview} />}

          {(state.kind === 'invalid' || state.kind === 'expired' || state.kind === 'used' || state.kind === 'revoked') && (
            <StatusMessage title={stateCopy[state.kind].title} text={stateCopy[state.kind].text} />
          )}

          {state.kind === 'error' && (
            <div className="rounded-lg border border-destructive/30 bg-destructive-soft p-4" role="alert">
              <div className="flex gap-3"><AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" aria-hidden="true" /><div><h2 className="font-semibold">Convite não aceito</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{state.message}</p></div></div>
            </div>
          )}

          {state.kind === 'success' && (
            <section className="rounded-lg border border-primary/25 bg-primary/5 p-5 text-center" role="status">
              <CheckCircle2 className="mx-auto h-9 w-9 text-primary" aria-hidden="true" />
              <h2 className="mt-3 text-xl font-semibold">Convite aceito</h2>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Seu vínculo com {state.preview.organization_name || 'a organização'} foi confirmado pelo servidor.</p>
              {state.importedInspections > 0 && <p className="mt-2 text-sm font-medium">{state.importedInspections} {state.importedInspections === 1 ? 'vistoria individual também foi importada' : 'vistorias individuais também foram importadas'}, sem alterar autoria ou protocolo.</p>}
              {state.accessRefreshFailed ? (
                <div className="mt-4 rounded-lg border border-warning/30 bg-warning-soft p-3 text-left text-sm" role="alert">
                  <p className="font-semibold">O vínculo foi confirmado, mas este navegador ainda não atualizou o acesso.</p>
                  <p className="mt-1 leading-5 text-muted-foreground">Recarregue o portal para consultar o novo vínculo municipal.</p>
                </div>
              ) : null}
              {state.accessRefreshFailed ? (
                <Button asChild className="mt-5 w-full"><a href="/portal/municipal">Recarregar e abrir portal municipal</a></Button>
              ) : (
                <Button className="mt-5 w-full" onClick={() => navigate('/portal/municipal', { replace: true })}>Abrir portal municipal</Button>
              )}
            </section>
          )}

          {(state.kind === 'ready' || state.kind === 'accepting' || state.kind === 'error') && (
            <div className="space-y-3">
              {session && <section className="rounded-xl border bg-secondary/40 p-4 text-left" aria-live="polite"><p className="text-sm font-semibold">Histórico feito sem organização</p>{historyLoading ? <p className="mt-2 text-xs text-muted-foreground">Consultando suas vistorias…</p> : history?.count ? <label className="mt-3 flex min-h-11 cursor-pointer items-start gap-3 text-sm"><Checkbox className="mt-1" checked={importHistory} onCheckedChange={(checked) => setImportHistory(checked === true)} /><span><strong>Trazer {history.count} vistoria{history.count === 1 ? '' : 's'} para esta organização</strong><span className="mt-1 block text-xs leading-5 text-muted-foreground">Período: {formatHistoryDate(history.firstAt)} a {formatHistoryDate(history.lastAt)}. Autoria e protocolos serão preservados.</span></span></label> : <p className="mt-2 text-xs text-muted-foreground">Nenhuma vistoria individual disponível para importar.</p>}</section>}
              {!session ? (
                <Button asChild className="w-full"><Link to={`/entrar?returnTo=${encodeURIComponent(`/convite/${token}`)}`}>Entrar com o e-mail do convite</Link></Button>
              ) : (
                <Button className="w-full" onClick={() => preview && void accept(preview)} disabled={isWorking}>
                  {isWorking ? <><LoaderCircle className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />Confirmando vínculo…</> : 'Aceitar convite e criar vínculo'}
                </Button>
              )}
              <p className="text-center text-xs leading-5 text-muted-foreground">Nenhum acesso é criado antes da confirmação do servidor.</p>
            </div>
          )}

          {state.kind !== 'loading' && state.kind !== 'success' && <Button asChild variant="ghost" className="w-full"><Link to="/">Voltar ao site</Link></Button>}
        </CardContent>
      </Card>
    </main>
  );
}

function formatHistoryDate(value: string | null) {
  if (!value) return 'não informado';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'não informado' : new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short' }).format(date);
}

function InviteDetails({ preview }: { preview: InvitePreview }) {
  return (
    <dl className="grid gap-4 rounded-lg border bg-secondary/60 p-4 text-sm">
      <div><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Building2 className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />Organização</dt><dd className="ml-6 mt-1 font-semibold">{preview.organization_name || 'Não informada'}</dd></div>
      <div><dt className="flex items-center gap-2 text-xs text-muted-foreground"><Mail className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />E-mail destinatário</dt><dd className="ml-6 mt-1 font-semibold">{preview.email_hint || 'Não informado'}</dd></div>
      <div><dt className="flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />Papel no portal</dt><dd className="ml-6 mt-1 font-semibold">{formatInviteRole(preview.role)}</dd></div>
      {preview.expires_at && <div><dt className="flex items-center gap-2 text-xs text-muted-foreground"><CalendarClock className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />Válido até</dt><dd className="ml-6 mt-1 font-semibold">{formatInviteDate(preview.expires_at)}</dd></div>}
    </dl>
  );
}

function StatusMessage({ title, text }: { title: string; text: string }) {
  return <section className="rounded-lg border bg-secondary/60 p-5 text-center" role="status"><AlertCircle className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" /><h2 className="mt-3 text-xl font-semibold">{title}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p></section>;
}

function formatInviteRole(role?: string) {
  if (role === 'coordinator') return 'Coordenador';
  if (role === 'supervisor') return 'Supervisor';
  if (role === 'agent') return 'Agente';
  return role || 'Não informado';
}

function formatInviteDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Data não informada';
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Sao_Paulo' }).format(date);
}

function acceptanceFailureMessage(reason?: string) {
  if (reason === 'membership_conflict') return 'Esta conta já possui outro vínculo municipal ativo.';
  if (reason === 'subscription_inactive') return 'A organização precisa regularizar o acesso antes de adicionar integrantes.';
  if (reason === 'limit_reached') return 'A organização atingiu o limite de integrantes do plano atual.';
  return 'Não foi possível aceitar este convite. Tente novamente ou solicite apoio ao administrador.';
}
