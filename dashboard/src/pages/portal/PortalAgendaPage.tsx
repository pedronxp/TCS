import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, ExternalLink, RefreshCw } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Skeleton } from '@/components/ui/Skeleton';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace, portalHome, portalRestrictionMessage } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

export function PortalAgendaPage() {
  const { access } = usePortalAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const requestedOpen = searchParams.get('novo') === '1';
  const open = requestedOpen && access?.creationAllowed === true;
  const formTriggerRef = useRef<HTMLButtonElement>(null);
  const agenda = useQuery({
    queryKey: ['portal', 'workspace', 'agenda', access?.userId, access?.accountKind, access?.organizationId, access?.role],
    queryFn: () => fetchPortalWorkspace('agenda'),
    enabled: Boolean(access),
  });
  const inspections = useQuery({
    queryKey: ['portal', 'workspace', 'vistorias', 'agenda', access?.userId, access?.accountKind, access?.organizationId, access?.role],
    queryFn: () => fetchPortalWorkspace('vistorias'),
    enabled: Boolean(access && open),
  });
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [inspectionId, setInspectionId] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!access || !requestedOpen || access.creationAllowed) return;
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      next.delete('novo');
      return next;
    }, { replace: true });
  }, [access, requestedOpen, setSearchParams]);

  if (!access) return null;
  const root = portalHome(access.accountKind);

  function setFormOpen(nextOpen: boolean, restoreFocus = false) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      if (nextOpen) next.set('novo', '1');
      else next.delete('novo');
      return next;
    }, { replace: true });
    if (nextOpen) setMessage(null);
    if (!nextOpen && restoreFocus) requestAnimationFrame(() => formTriggerRef.current?.focus());
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsedDate = new Date(scheduledAt);
    if (!title.trim() || Number.isNaN(parsedDate.getTime())) {
      setMessage({ kind: 'error', text: 'Revise o título, a data e a hora do compromisso.' });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const { error } = await supabase.rpc('portal_create_appointment', {
        p_inspection_id: inspectionId || null,
        p_title: title.trim(),
        p_scheduled_at: parsedDate.toISOString(),
        p_notes: notes.trim() || null,
      });
      if (error) throw new Error(error.message);
      setFormOpen(false);
      setTitle('');
      setScheduledAt('');
      setInspectionId('');
      setNotes('');
      setMessage({ kind: 'success', text: 'Agendamento criado e incluído na agenda.' });
      void agenda.refetch();
    } catch {
      setMessage({ kind: 'error', text: 'Não foi possível criar o agendamento. Nenhuma alteração foi salva.' });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="page-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Operação</p>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.025em]">Agenda</h1>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">Organize compromissos vinculados às vistorias autorizadas para o seu escopo.</p>
        </div>
        <Button ref={formTriggerRef} onClick={() => setFormOpen(!open)} disabled={!access.creationAllowed} aria-expanded={open} aria-controls={open ? 'new-appointment-form' : undefined}><CalendarPlus aria-hidden="true" />{open ? 'Fechar formulário' : 'Novo agendamento'}</Button>
      </header>

      {!access.creationAllowed && (
        <p className="rounded-md border border-border bg-secondary p-4 text-sm text-muted-foreground" role="status">{portalRestrictionMessage(access.restrictionCause) || 'Novos agendamentos estão indisponíveis para este acesso.'}</p>
      )}
      {message && <p className={`rounded-md border p-3 text-sm ${message.kind === 'error' ? 'border-destructive/30 bg-destructive-soft text-destructive' : 'border-success/30 bg-success-soft text-foreground'}`} role={message.kind === 'error' ? 'alert' : 'status'}>{message.text}</p>}

      {open && access.creationAllowed && (
        <Card id="new-appointment-form">
          <CardHeader><CardTitle>Novo agendamento</CardTitle><p className="text-sm text-muted-foreground">Informe quando acontecerá e vincule uma vistoria somente quando necessário.</p></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submit}>
              <label className="text-sm font-medium" htmlFor="appointment-title">Título<Input id="appointment-title" className="mt-2" value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} required autoFocus /></label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium" htmlFor="appointment-date">Data e hora<Input id="appointment-date" className="mt-2" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required /></label>
                <label className="text-sm font-medium" htmlFor="appointment-inspection">Vistoria
                  <select id="appointment-inspection" className="mt-2 h-11 w-full rounded-md border border-border bg-card px-3 text-sm" value={inspectionId} onChange={(event) => setInspectionId(event.target.value)} disabled={inspections.isLoading || inspections.isError}>
                    <option value="">{inspections.isLoading ? 'Carregando vistorias…' : inspections.isError ? 'Vistorias indisponíveis' : 'Sem vínculo'}</option>
                    {inspections.data?.items.map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.protocol ?? item.title ?? 'Vistoria')}</option>)}
                  </select>
                </label>
              </div>
              {inspections.isError && <p className="text-sm text-destructive" role="alert">Não foi possível carregar as vistorias. Você ainda pode salvar o compromisso sem vínculo. <button type="button" className="font-semibold underline underline-offset-4" onClick={() => void inspections.refetch()}>Tentar novamente</button></p>}
              <label className="text-sm font-medium" htmlFor="appointment-notes">Observações<textarea id="appointment-notes" className="mt-2 min-h-24 w-full rounded-md border border-border bg-card p-3 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} maxLength={1000} /></label>
              <div className="flex flex-wrap gap-2"><Button disabled={submitting}>{submitting ? 'Salvando…' : 'Salvar agendamento'}</Button><Button type="button" variant="outline" onClick={() => setFormOpen(false, true)} disabled={submitting}>Cancelar</Button></div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card aria-busy={agenda.isLoading}>
        <CardHeader className="border-b border-border"><CardTitle>Próximos compromissos</CardTitle></CardHeader>
        <CardContent>
          {agenda.isLoading && <div className="space-y-3 py-2" role="status" aria-label="Carregando agenda"><span className="sr-only">Carregando agenda…</span>{Array.from({ length: 3 }, (_, index) => <Skeleton key={index} className="h-20 motion-reduce:animate-none" />)}</div>}
          {agenda.isError && <div className="grid min-h-56 place-items-center text-center" role="alert"><div><p className="font-semibold">Não foi possível carregar a agenda</p><p className="mt-2 text-sm text-muted-foreground">Tente novamente sem perder os dados do formulário.</p><Button className="mt-4" variant="outline" onClick={() => void agenda.refetch()}><RefreshCw aria-hidden="true" />Tentar novamente</Button></div></div>}
          {agenda.data?.items.length === 0 && <div className="grid min-h-56 place-items-center text-center"><div><CalendarPlus className="mx-auto h-8 w-8 text-primary" aria-hidden="true" /><h2 className="mt-4 font-semibold">Nenhum compromisso agendado</h2><p className="mt-2 text-sm text-muted-foreground">{access.creationAllowed ? 'Crie o primeiro compromisso para organizar a próxima ação.' : 'Quando um compromisso for criado no seu escopo, ele aparecerá aqui.'}</p></div></div>}
          {agenda.data && agenda.data.items.length > 0 && (
            <ul className="divide-y divide-border">
              {agenda.data.items.map((item) => (
                <li key={String(item.id)} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                  <div><p className="text-sm font-semibold">{String(item.title ?? 'Compromisso')}</p><p className="mt-1 text-xs text-muted-foreground">{formatDate(item.scheduled_at)}</p></div>
                  <div className="flex flex-wrap items-center gap-2"><Badge>{humanize(String(item.status ?? 'agendado'))}</Badge>{Boolean(item.inspection_id) && <Button asChild variant="ghost" size="sm" className="min-h-11"><Link to={`${root}/vistorias/${encodeURIComponent(String(item.inspection_id))}?returnTo=${encodeURIComponent(`${root}/agenda`)}`}><ExternalLink aria-hidden="true" />Ver vistoria</Link></Button>}</div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function formatDate(value: unknown) {
  if (typeof value !== 'string') return 'Data não informada';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? 'Data não informada' : parsed.toLocaleString('pt-BR');
}

function humanize(value: string) {
  const normalized = value.replace(/_/g, ' ');
  return normalized.charAt(0).toLocaleUpperCase('pt-BR') + normalized.slice(1);
}
