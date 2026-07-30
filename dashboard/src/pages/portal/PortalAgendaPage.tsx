import { useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CalendarPlus, ExternalLink } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace, portalHome } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

export function PortalAgendaPage() {
  const { access } = usePortalAuth();
  const agenda = useQuery({ queryKey: ['portal', 'workspace', 'agenda'], queryFn: () => fetchPortalWorkspace('agenda') });
  const inspections = useQuery({ queryKey: ['portal', 'workspace', 'vistorias', 'agenda'], queryFn: () => fetchPortalWorkspace('vistorias') });
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [inspectionId, setInspectionId] = useState('');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  if (!access) return null;
  const root = portalHome(access.accountKind);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const { error } = await supabase.rpc('portal_create_appointment', {
      p_inspection_id: inspectionId || null,
      p_title: title,
      p_scheduled_at: new Date(scheduledAt).toISOString(),
      p_notes: notes || null,
    });
    if (error) {
      setMessage('Não foi possível criar o agendamento.');
      return;
    }
    setOpen(false);
    setTitle('');
    setScheduledAt('');
    setInspectionId('');
    setNotes('');
    setMessage('Agendamento criado.');
    void agenda.refetch();
  }

  return (
    <div className="page-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Operação</p><h1 className="mt-2 text-3xl font-semibold">Agenda</h1><p className="mt-2 text-sm text-muted-foreground">Compromissos vinculados às vistorias do seu escopo.</p></div><Button onClick={() => setOpen((value) => !value)} disabled={!access.creationAllowed}><CalendarPlus />Novo agendamento</Button></header>
      {message && <p className="rounded-md border bg-card p-3 text-sm" role="status">{message}</p>}
      {agenda.isLoading && <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">Carregando agenda…</p>}
      {agenda.isError && <p className="rounded-md border border-destructive/20 bg-status-danger p-4 text-sm" role="alert">Não foi possível carregar a agenda.</p>}
      {open && <Card><CardHeader><CardTitle>Novo agendamento</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={submit}><label className="text-sm font-medium">Título<Input className="mt-2" value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} required /></label><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Data e hora<Input className="mt-2" type="datetime-local" value={scheduledAt} onChange={(event) => setScheduledAt(event.target.value)} required /></label><label className="text-sm font-medium">Vistoria<select className="mt-2 h-11 w-full rounded-md border bg-card px-3" value={inspectionId} onChange={(event) => setInspectionId(event.target.value)}><option value="">Sem vínculo</option>{inspections.data?.items.map((item) => <option key={String(item.id)} value={String(item.id)}>{String(item.protocol ?? item.title)}</option>)}</select></label></div><label className="text-sm font-medium">Observações<textarea className="mt-2 min-h-24 w-full rounded-md border bg-card p-3 text-sm" value={notes} onChange={(event) => setNotes(event.target.value)} /></label><div className="flex gap-2"><Button>Salvar</Button><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancelar</Button></div></form></CardContent></Card>}
      <Card><CardHeader><CardTitle>Compromissos</CardTitle></CardHeader><CardContent><ul className="divide-y">{agenda.data?.items.map((item) => <li key={String(item.id)} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold">{String(item.title)}</p><p className="mt-1 text-xs text-muted-foreground">{item.scheduled_at ? new Date(String(item.scheduled_at)).toLocaleString('pt-BR') : 'Sem data'}</p></div><div className="flex items-center gap-2"><Badge>{String(item.status)}</Badge>{Boolean(item.inspection_id) && <Button asChild variant="ghost" size="sm" className="min-h-11"><Link to={`${root}/vistorias/${String(item.inspection_id)}`}><ExternalLink />Vistoria</Link></Button>}</div></li>)}</ul>{agenda.data?.items.length === 0 && <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum compromisso.</p>}</CardContent></Card>
    </div>
  );
}
