import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, UserRoundPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace, portalHome, portalRestrictionMessage } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

export function PortalInvitesPage() {
  const { access, can } = usePortalAuth();
  const query = useQuery({
    queryKey: ['portal', 'workspace', 'convites', access?.userId, access?.accountKind, access?.organizationId ?? null, access?.role ?? null],
    queryFn: () => fetchPortalWorkspace('convites'),
    enabled: Boolean(access),
  });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('agent');
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const allowedRoles = access?.role === 'master'
    ? ['agent', 'supervisor', 'admin']
    : access?.role === 'admin'
      ? ['agent', 'supervisor']
      : ['agent'];
  const mayInvite = can('invite.manage') || can('invite.agent');
  const subscriptionBlocksCreation = access ? !access.creationAllowed : false;
  const root = portalHome(access?.accountKind ?? 'individual');

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!mayInvite) {
      setErrorMessage('Seu papel não permite criar convites.');
      return;
    }
    setSubmitting(true);
    setStatusMessage(null);
    setErrorMessage(null);
    setInviteUrl(null);
    const { data, error } = await supabase.rpc('portal_create_organization_invite', {
      p_email: email,
      p_role: role,
      p_expires_in_hours: 72,
    });
    setSubmitting(false);
    const result = data as { allowed?: boolean; token?: string; reason?: string } | null;
    if (error || !result?.allowed || !result.token) {
      setErrorMessage(result?.reason === 'limit_reached' ? 'O limite de pessoas do plano foi atingido.' : 'Não foi possível criar o convite. Revise o e-mail e tente novamente.');
      return;
    }
    setInviteUrl(`${window.location.origin}/convite/${result.token}`);
    setEmail('');
    void query.refetch();
  }

  async function copy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setStatusMessage('Link copiado. Compartilhe somente com o e-mail informado.');
  }

  return (
    <div className="page-stack">
      {subscriptionBlocksCreation && mayInvite && (
        <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-foreground" role="status">
          O convite fica em consulta: {portalRestrictionMessage(access?.restrictionCause ?? null)}{' '}
          <Link to={`${root}/assinatura`} className="font-semibold underline underline-offset-2 outline-none focus-visible:ring-2 focus-visible:ring-ring">Ver assinatura</Link>
        </p>
      )}
      {!mayInvite && <p className="rounded-md border bg-secondary p-3 text-sm text-muted-foreground" role="status">Seu papel pode consultar o histórico, mas não emitir convites.</p>}
      <header><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Equipe municipal</p><h1 className="mt-2 text-3xl font-semibold">Convites</h1><p className="mt-2 text-sm text-muted-foreground">Cada link é associado à organização, ao papel e ao e-mail verificado do destinatário.</p></header>
      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserRoundPlus />Convidar pessoa</CardTitle></CardHeader>
          <CardContent>
            {mayInvite && !subscriptionBlocksCreation && <form className="space-y-4" onSubmit={submit}>
              <label className="block text-sm font-medium">E-mail<Input className="mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <label className="block text-sm font-medium">Papel<select className="mt-2 h-11 w-full rounded-md border bg-card px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value)}>{allowedRoles.map((allowedRole) => <option key={allowedRole} value={allowedRole}>{allowedRole}</option>)}</select></label>
              <Button className="w-full" disabled={submitting}>{submitting ? 'Criando…' : 'Criar convite'}</Button>
            </form>}
            {mayInvite && subscriptionBlocksCreation && (
              <div className="space-y-3">
                <Button className="w-full" disabled title={portalRestrictionMessage(access?.restrictionCause ?? null)}>Criar convite</Button>
                <p className="text-xs text-muted-foreground">O botão de convite está desabilitado porque a assinatura não permite novas operações. Regularize a assinatura para voltar a convidar pessoas.</p>
              </div>
            )}
            {!mayInvite && <p className="text-sm text-muted-foreground">Apenas coordenadores podem emitir convites. Você está em modo de consulta ao histórico.</p>}
            {inviteUrl && <div className="mt-4 rounded-md border border-success/25 bg-success-soft p-3" role="status"><p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Check className="h-4 w-4" />Convite criado</p><Button className="mt-3 w-full" variant="outline" onClick={() => void copy()}><Copy />Copiar link seguro</Button></div>}
            {statusMessage && <p className="mt-4 text-sm text-muted-foreground" role="status">{statusMessage}</p>}
            {errorMessage && <p className="mt-4 rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{errorMessage}</p>}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Histórico</CardTitle></CardHeader><CardContent>{query.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}{query.isError && <div className="space-y-3 text-sm text-destructive" role="alert"><p>Não foi possível carregar os convites.</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}{query.data?.items.length === 0 && <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum convite emitido.</p>}<ul className="divide-y">{query.data?.items.map((item) => <li key={String(item.id)} className="flex min-w-0 flex-wrap items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="break-all text-sm font-semibold">{String(item.title)}</p><p className="mt-1 text-xs text-muted-foreground">{String(item.subtitle)}</p></div><span className="text-xs font-semibold">{String(item.status)}</span></li>)}</ul></CardContent></Card>
      </section>
    </div>
  );
}
