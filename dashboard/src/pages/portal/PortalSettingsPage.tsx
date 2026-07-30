import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Building2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

export function PortalSettingsPage() {
  const { access, can } = usePortalAuth();
  const query = useQuery({
    queryKey: ['portal', 'workspace', 'configuracoes', access?.organizationId],
    queryFn: () => fetchPortalWorkspace('configuracoes'),
  });
  const [displayName, setDisplayName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [sessionTimeout, setSessionTimeout] = useState('480');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const item = query.data?.items[0];
  const mayManage = can('settings.manage');

  useEffect(() => {
    if (!item) return;
    setDisplayName(String(item.display_name ?? item.title ?? ''));
    setContactName(String(item.contact_name ?? ''));
    setContactEmail(String(item.contact_email ?? ''));
    setSessionTimeout(String(item.session_timeout_minutes ?? 480));
  }, [item]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!mayManage) return;
    setSubmitting(true);
    setMessage(null);
    const { error } = await supabase.rpc('portal_update_organization_settings', {
      p_display_name: displayName,
      p_contact_name: contactName,
      p_contact_email: contactEmail,
      p_session_timeout_minutes: Number(sessionTimeout),
      p_reason: reason,
      p_confirmation: confirmation,
    });
    setSubmitting(false);
    if (error) {
      setMessage('Não foi possível salvar. Revise os dados, a justificativa e a confirmação.');
      return;
    }
    setReason('');
    setConfirmation('');
    setMessage('Configurações atualizadas e registradas na auditoria.');
    void query.refetch();
  }

  return (
    <div className="page-stack">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Administração municipal</p>
        <h1 className="mt-2 text-3xl font-semibold">Configurações</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">Identidade operacional, contato e política de sessão da organização.</p>
      </header>
      {message && <p className="rounded-md border bg-card p-3 text-sm" role="status">{message}</p>}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 />Organização</CardTitle></CardHeader>
        <CardContent>
          {query.isLoading && <p className="text-sm text-muted-foreground">Carregando configurações…</p>}
          {query.isError && <p className="text-sm text-destructive">Não foi possível carregar as configurações.</p>}
          {item && (
            <form className="grid gap-4" onSubmit={submit}>
              <label className="text-sm font-medium">Nome de exibição
                <Input className="mt-2" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={3} maxLength={120} disabled={!mayManage} required />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">Contato responsável
                  <Input className="mt-2" value={contactName} onChange={(event) => setContactName(event.target.value)} disabled={!mayManage} />
                </label>
                <label className="text-sm font-medium">E-mail de contato
                  <Input className="mt-2" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} disabled={!mayManage} />
                </label>
              </div>
              <label className="text-sm font-medium">Expiração da sessão (minutos)
                <Input className="mt-2" type="number" min={5} max={43200} value={sessionTimeout} onChange={(event) => setSessionTimeout(event.target.value)} disabled={!mayManage} required />
              </label>
              {mayManage ? (
                <div className="grid gap-4 rounded-lg border border-amber-300 bg-amber-50 p-4 text-amber-950">
                  <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />Alteração auditável</p>
                  <label className="text-sm font-medium">Justificativa
                    <textarea className="mt-2 min-h-24 w-full rounded-md border bg-white p-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} required />
                  </label>
                  <label className="text-sm font-medium">Digite CONFIRMAR
                    <Input className="mt-2 bg-white" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required />
                  </label>
                  <Button className="w-fit" disabled={submitting || confirmation !== 'CONFIRMAR' || reason.trim().length < 10}>{submitting ? 'Salvando…' : 'Salvar configurações'}</Button>
                </div>
              ) : <p className="text-sm text-muted-foreground">Seu papel permite consultar estas configurações, mas não alterá-las.</p>}
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
