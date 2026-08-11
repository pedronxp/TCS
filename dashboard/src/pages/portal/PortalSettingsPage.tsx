import { useEffect, useState, type FormEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Building2, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

export function PortalSettingsPage() {
  const { access, can } = usePortalAuth();
  const queryClient = useQueryClient();
  const queryKey = ['portal', 'workspace', 'configuracoes', access?.userId, access?.accountKind, access?.organizationId ?? null] as const;
  const query = useQuery({
    queryKey,
    queryFn: () => fetchPortalWorkspace('configuracoes'),
    enabled: Boolean(access),
  });
  const [displayName, setDisplayName] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [sessionTimeout, setSessionTimeout] = useState('480');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [baseline, setBaseline] = useState({ displayName: '', contactName: '', contactEmail: '', sessionTimeout: '480' });
  const item = query.data?.items[0];
  const mayManage = can('settings.manage');
  const dirty = Boolean(item) && (
    displayName !== baseline.displayName
    || contactName !== baseline.contactName
    || contactEmail !== baseline.contactEmail
    || sessionTimeout !== baseline.sessionTimeout
  );

  useEffect(() => {
    if (!item) return;
    const nextBaseline = {
      displayName: String(item.display_name ?? item.title ?? ''),
      contactName: String(item.contact_name ?? ''),
      contactEmail: String(item.contact_email ?? ''),
      sessionTimeout: String(item.session_timeout_minutes ?? 480),
    };
    setDisplayName(nextBaseline.displayName);
    setContactName(nextBaseline.contactName);
    setContactEmail(nextBaseline.contactEmail);
    setSessionTimeout(nextBaseline.sessionTimeout);
    setBaseline(nextBaseline);
  }, [item]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!mayManage) return;
    setSubmitting(true);
    setSuccessMessage(null);
    setErrorMessage(null);
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
      setErrorMessage('Não foi possível salvar. Revise os dados, a justificativa e a confirmação.');
      return;
    }
    const saved = {
      displayName: displayName.trim(),
      contactName: contactName.trim(),
      contactEmail: contactEmail.trim().toLowerCase(),
      sessionTimeout: String(Number(sessionTimeout)),
    };
    setDisplayName(saved.displayName);
    setContactName(saved.contactName);
    setContactEmail(saved.contactEmail);
    setSessionTimeout(saved.sessionTimeout);
    setBaseline(saved);
    queryClient.setQueryData(queryKey, (current: typeof query.data) => current ? {
      ...current,
      items: current.items.map((currentItem, index) => index === 0 ? {
        ...currentItem,
        title: saved.displayName,
        display_name: saved.displayName,
        contact_name: saved.contactName,
        contact_email: saved.contactEmail,
        session_timeout_minutes: Number(saved.sessionTimeout),
      } : currentItem),
    } : current);
    setReason('');
    setConfirmation('');
    setSavedAt(Date.now());
    setSuccessMessage('Configurações atualizadas e registradas na auditoria.');
    void query.refetch();
  }

  return (
    <div className="space-y-5">
      {dirty && <p className="rounded-md border border-warning/30 bg-warning-soft p-2.5 text-sm" role="status">Alterações não salvas.</p>}
      {savedAt && !dirty && <p className="rounded-md border border-success/30 bg-success-soft p-2.5 text-sm" role="status">Salvo agora e registrado na auditoria.</p>}
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Administração municipal</p>
        <h1 className="mt-1.5 text-2xl font-semibold">Configurações</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-muted-foreground">Identidade operacional, contato e política de sessão da organização.</p>
      </header>
      {successMessage && <p className="rounded-md border bg-card p-2.5 text-sm" role="status">{successMessage}</p>}
      {errorMessage && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-2.5 text-sm text-destructive" role="alert">{errorMessage}</p>}
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Building2 />Organização</CardTitle></CardHeader>
        <CardContent>
          {query.isLoading && <p className="text-sm text-muted-foreground">Carregando configurações…</p>}
          {query.isError && <div className="space-y-3 text-sm text-destructive" role="alert"><p>Não foi possível carregar as configurações.</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}
          {item && (
            <form className="grid gap-3" onSubmit={submit}>
              <label className="text-sm font-medium">Nome de exibição
                <Input className="mt-1.5" value={displayName} onChange={(event) => setDisplayName(event.target.value)} minLength={3} maxLength={120} disabled={!mayManage} required />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm font-medium">Contato responsável
                  <Input className="mt-1.5" value={contactName} onChange={(event) => setContactName(event.target.value)} disabled={!mayManage} />
                </label>
                <label className="text-sm font-medium">E-mail de contato
                  <Input className="mt-1.5" type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} disabled={!mayManage} />
                </label>
              </div>
              <label className="text-sm font-medium">Expiração da sessão (minutos)
                <Input className="mt-1.5" type="number" min={5} max={43200} value={sessionTimeout} onChange={(event) => setSessionTimeout(event.target.value)} disabled={!mayManage} required />
              </label>
              {mayManage ? (
                <div className="grid gap-3 rounded-lg border border-warning/30 bg-warning-soft p-3.5 text-foreground">
                  <p className="flex items-center gap-2 text-sm font-semibold"><ShieldCheck className="h-4 w-4" />Alteração auditável</p>
                  <label className="text-sm font-medium">Justificativa
                    <textarea className="mt-1.5 min-h-20 w-full rounded-md border bg-card p-2.5 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} required />
                  </label>
                  <label className="text-sm font-medium">Digite CONFIRMAR
                    <Input className="mt-1.5 bg-card" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required />
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
