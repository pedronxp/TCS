import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertCircle, Headphones, MessageCircle, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

type SupportTicket = Record<string, unknown>;

const priorityLabels: Record<string, string> = {
  low: 'Baixa',
  normal: 'Normal',
  high: 'Alta',
  critical: 'Crítica',
};

const categoryLabels: Record<string, string> = {
  operacao: 'Operação',
  tecnico: 'Técnico',
  financeiro: 'Financeiro',
};

export function PortalSupportPage() {
  const { access, can } = usePortalAuth();
  const mayCreate = can('support.create');
  const query = useQuery({
    queryKey: ['portal', 'workspace', 'suporte', access?.userId, access?.accountKind, access?.organizationId ?? null, access?.role ?? null],
    queryFn: () => fetchPortalWorkspace('suporte'),
    enabled: Boolean(access),
  });
  const [open, setOpen] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('operacao');
  const [priority, setPriority] = useState('normal');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const formTitleRef = useRef<HTMLHeadingElement>(null);
  const pageTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { if (open) formTitleRef.current?.focus(); }, [open]);
  useEffect(() => {
    if (mayCreate || !open) return;
    setOpen(false);
    window.setTimeout(() => pageTitleRef.current?.focus(), 0);
  }, [mayCreate, open]);

  function closeForm() {
    setOpen(false);
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!mayCreate) {
      setErrorMessage('Sua permissão para abrir chamados não está mais disponível.');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    const { error } = await supabase.rpc('open_support_ticket', {
      p_category: category,
      p_subject: subject,
      p_description: description,
      p_priority: priority,
    });
    setSubmitting(false);
    if (error) {
      setErrorMessage('Não foi possível abrir o chamado. Revise os dados e tente novamente.');
      return;
    }
    setSubject('');
    setDescription('');
    closeForm();
    setSuccessMessage('Chamado aberto com sucesso.');
    void query.refetch();
  }

  return (
    <div className="page-stack">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Atendimento</p>
          <h1 ref={pageTitleRef} tabIndex={-1} className="mt-2 text-3xl font-semibold">Suporte</h1>
          <p className="mt-2 text-sm text-muted-foreground">Acompanhe solicitações e atualizações do seu escopo.</p>
        </div>
        {mayCreate && <Button ref={triggerRef} aria-expanded={open} aria-controls="portal-support-form" onClick={() => open ? closeForm() : setOpen(true)}><Plus />{open ? 'Fechar formulário' : 'Abrir chamado'}</Button>}
      </header>
      {!mayCreate && <p className="rounded-md border bg-secondary p-3 text-sm text-muted-foreground" role="status">Seu acesso permite consultar chamados, mas não abrir novas solicitações.</p>}
      {successMessage && <p className="rounded-md border bg-card p-3 text-sm" role="status">{successMessage}</p>}
      {errorMessage && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{errorMessage}</p>}
      {open && mayCreate && <Card id="portal-support-form"><CardHeader><CardTitle ref={formTitleRef} tabIndex={-1} className="flex items-center gap-2"><Headphones />Novo chamado</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Categoria<select className="mt-2 h-11 w-full rounded-md border bg-card px-3" value={category} onChange={(event) => setCategory(event.target.value)}><option value="operacao">Operação</option><option value="tecnico">Técnico</option><option value="financeiro">Financeiro</option></select></label><label className="text-sm font-medium">Prioridade<select className="mt-2 h-11 w-full rounded-md border bg-card px-3" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label></div><label className="text-sm font-medium">Assunto<Input className="mt-2" value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={200} required /></label><label className="text-sm font-medium">Descrição<textarea className="mt-2 min-h-32 w-full rounded-md border bg-card p-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} required /></label><div className="flex gap-2"><Button disabled={submitting || !mayCreate}>{submitting ? 'Enviando…' : 'Enviar chamado'}</Button><Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button></div></form></CardContent></Card>}
      <Card>
        <CardHeader><CardTitle>Chamados</CardTitle>{query.data && <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-sm"><SupportMetric label="Total" value={query.data.summary.total} /><SupportMetric label="Em aberto" value={query.data.summary.open} /></div>}</CardHeader>
        <CardContent>
          {query.isLoading && <p className="text-sm text-muted-foreground">Carregando chamados…</p>}
          {query.isError && <div className="space-y-3 text-sm text-destructive" role="alert"><p>Não foi possível carregar os chamados.</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}
          <ul className="divide-y">
            {query.data?.items.map((item) => {
              const ticket = item as SupportTicket;
              const title = ticketText(ticket.title, 'Chamado sem assunto');
              return <li key={String(ticket.id)} className="py-4"><button type="button" className="flex w-full items-start justify-between gap-4 rounded-lg text-left outline-none transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setSelectedTicket(ticket)} aria-label={`Ver detalhes de ${title}`}><div className="min-w-0"><p className="truncate text-sm font-semibold">{title}</p><p className="mt-1 text-xs text-muted-foreground">{ticketText(ticket.subtitle, 'Sem protocolo')} · {categoryLabel(ticket.category)}</p><p className="mt-2 text-xs text-muted-foreground">Prioridade {priorityLabel(ticket.priority)} · {formatTicketDate(ticket.created_at)}</p></div><Badge>{ticketText(ticket.status, 'open')}</Badge></button></li>;
            })}
          </ul>
          {query.data?.items.length === 0 && <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum chamado aberto.</p>}
        </CardContent>
      </Card>
      <Dialog open={Boolean(selectedTicket)} onOpenChange={(nextOpen) => !nextOpen && setSelectedTicket(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{ticketText(selectedTicket?.title, 'Chamado')}</DialogTitle>
            <DialogDescription>{ticketText(selectedTicket?.subtitle, 'Sem protocolo')}</DialogDescription>
          </DialogHeader>
          {selectedTicket && <div className="space-y-5 text-sm"><div className="grid gap-3 sm:grid-cols-2"><TicketInfo label="Status" value={ticketText(selectedTicket.status, 'Em aberto')} /><TicketInfo label="Prioridade" value={priorityLabel(selectedTicket.priority)} /><TicketInfo label="Categoria" value={categoryLabel(selectedTicket.category)} /><TicketInfo label="Criado em" value={formatTicketDate(selectedTicket.created_at)} /></div><div className="rounded-lg border bg-muted/30 p-4"><p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Descrição</p><p className="mt-2 whitespace-pre-wrap leading-6 text-foreground">{ticketText(selectedTicket.description, 'Nenhuma descrição disponível.')}</p></div><PublicResponseTimeline ticketId={String(selectedTicket.id ?? '')} /></div>}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ticketText(value: unknown, fallback: string) {
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function priorityLabel(value: unknown) {
  const key = ticketText(value, 'normal');
  return priorityLabels[key] ?? key;
}

function categoryLabel(value: unknown) {
  const key = ticketText(value, 'operacao');
  return categoryLabels[key] ?? key;
}

function formatTicketDate(value: unknown) {
  const date = typeof value === 'string' ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) return 'Data não disponível';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

function TicketInfo({ label, value }: { label: string; value: string }) {
  return <div><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium text-foreground">{value}</p></div>;
}

/**
 * Linha do tempo de respostas públicas do chamado, visível ao cliente municipal.
 *
 * Restrição de paridade operacional: o portal nunca pode exibir notas internas da equipe
 * (event_type "note"). O backend ainda não expõe um contrato de eventos voltado ao portal
 * (portal_get_support_events). Até que esse endpoint exista, a seção apresenta o estado
 * "em integração" — sem inventar respostas e sem ler a tabela support_ticket_events diretamente.
 */
function PublicResponseTimeline({ ticketId }: { ticketId: string }) {
  const query = useQuery({
    queryKey: ['portal', 'support-events', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('portal_get_support_events', { p_ticket_id: ticketId });
      if (error) throw new Error(error.message);
      return data as Array<Record<string, unknown>>;
    },
    retry: 0,
  });

  return (
    <div className="rounded-lg border p-4" aria-label="Respostas do suporte">
      <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MessageCircle className="h-4 w-4" aria-hidden="true" />Respostas do suporte
      </p>

      {query.isLoading && (
        <p className="mt-3 text-sm text-muted-foreground" role="status">Carregando respostas…</p>
      )}

      {query.isError && (
        <div className="mt-3 space-y-3" role="alert">
          <div className="flex items-start gap-3 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-foreground">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
            <div>
              <p className="font-medium">Respostas em integração</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                Acompanhe o andamento do chamado pela situação acima. A linha do tempo de respostas
                da equipe aparecerá aqui assim que o contrato de eventos do portal for liberado, sem
                nova implantação. Suas mensagens permanecem registradas no protocolo.
              </p>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Notas internas da equipe nunca são exibidas neste espaço.
          </p>
        </div>
      )}

      {query.data && query.data.length === 0 && (
        <p className="mt-3 text-sm text-muted-foreground">Nenhuma resposta registrada ainda.</p>
      )}

      {query.data && query.data.length > 0 && (() => {
        // Barreira de apresentação: o portal nunca exibe notas internas (event_type "note"),
        // mesmo que o contrato eventualmente as retorne. Somente respostas voltadas ao cliente.
        const publicEvents = query.data.filter((event) => {
          const type = ticketText(event.event_type, '');
          return type !== 'note';
        });
        if (publicEvents.length === 0) return <p className="mt-3 text-sm text-muted-foreground">Nenhuma resposta registrada ainda.</p>;
        return (
          <ol className="mt-3 space-y-3" role="list">
            {publicEvents.map((event) => {
              const message = ticketText(event.message, '');
              const createdAt = formatTicketDate(event.created_at);
              return (
                <li key={String(event.id)} className="rounded-md border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-xs font-medium text-foreground">Resposta do suporte</p>
                    <time className="text-xs text-muted-foreground">{createdAt}</time>
                  </div>
                  {message && <p className="mt-1 whitespace-pre-wrap leading-6 text-foreground">{message}</p>}
                </li>
              );
            })}
          </ol>
        );
      })()}
    </div>
  );
}

function SupportMetric({ label, value }: { label: string; value: unknown }) {
  return <div className="rounded-lg border bg-muted/30 px-3 py-2"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-lg font-semibold text-foreground">{typeof value === 'number' ? value : 0}</p></div>;
}
