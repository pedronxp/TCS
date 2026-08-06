import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, Copy, UserRoundPlus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

export function PortalInvitesPage() {
  const { access } = usePortalAuth();
  const query = useQuery({ queryKey: ['portal', 'workspace', 'convites'], queryFn: () => fetchPortalWorkspace('convites') });
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('agent');
  const [submitting, setSubmitting] = useState(false);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const allowedRoles = access?.role === 'supervisor' ? ['agent'] : ['agent', 'supervisor', 'coordinator'];

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setMessage(null);
    const { data, error } = await supabase.rpc('portal_create_organization_invite', {
      p_email: email,
      p_role: role,
      p_expires_in_hours: 72,
    });
    setSubmitting(false);
    const result = data as { allowed?: boolean; delivery_token?: string; reason?: string } | null;
    if (error || !result?.allowed || !result.delivery_token) {
      setMessage(result?.reason === 'limit_reached' ? 'O limite de pessoas do plano foi atingido.' : 'Não foi possível criar o convite.');
      return;
    }
    setInviteUrl(`${window.location.origin}/convite/${result.delivery_token}`);
    setEmail('');
    void query.refetch();
  }

  async function copy() {
    if (!inviteUrl) return;
    await navigator.clipboard.writeText(inviteUrl);
    setMessage('Link copiado. Compartilhe somente com o e-mail informado.');
  }

  return (
    <div className="page-stack">
      <header><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Equipe municipal</p><h1 className="mt-2 text-3xl font-semibold">Convites</h1><p className="mt-2 text-sm text-muted-foreground">Cada link é associado à organização, ao papel e ao e-mail verificado do destinatário.</p></header>
      <section className="grid gap-4 xl:grid-cols-[0.72fr_1.28fr]">
        <Card>
          <CardHeader><CardTitle className="flex items-center gap-2"><UserRoundPlus />Convidar pessoa</CardTitle></CardHeader>
          <CardContent>
            <form className="space-y-4" onSubmit={submit}>
              <label className="block text-sm font-medium">E-mail<Input className="mt-2" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
              <label className="block text-sm font-medium">Papel<select className="mt-2 h-11 w-full rounded-md border bg-card px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value)}>{allowedRoles.map((allowedRole) => <option key={allowedRole} value={allowedRole}>{allowedRole}</option>)}</select></label>
              <Button className="w-full" disabled={submitting}>{submitting ? 'Criando…' : 'Criar convite'}</Button>
            </form>
            {inviteUrl && <div className="mt-4 rounded-md border border-success/25 bg-success-soft p-3"><p className="flex items-center gap-2 text-sm font-semibold text-foreground"><Check className="h-4 w-4" />Convite criado</p><Button className="mt-3 w-full" variant="outline" onClick={() => void copy()}><Copy />Copiar link seguro</Button></div>}
            {message && <p className="mt-4 text-sm text-muted-foreground" role="status">{message}</p>}
          </CardContent>
        </Card>
        <Card><CardHeader><CardTitle>Histórico</CardTitle></CardHeader><CardContent>{query.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}{query.isError && <p className="text-sm text-destructive" role="alert">Não foi possível carregar os convites.</p>}{query.data?.items.length === 0 && <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum convite emitido.</p>}<ul className="divide-y">{query.data?.items.map((item) => <li key={String(item.id)} className="flex min-w-0 flex-wrap items-center justify-between gap-4 py-4"><div className="min-w-0"><p className="break-all text-sm font-semibold">{String(item.title)}</p><p className="mt-1 text-xs text-muted-foreground">{String(item.subtitle)}</p></div><span className="text-xs font-semibold">{String(item.status)}</span></li>)}</ul></CardContent></Card>
      </section>
    </div>
  );
}
