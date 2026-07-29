import { useMemo, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Filter, Send, StickyNote } from 'lucide-react';
import { StatusBadge } from '@/components/domain/Badges';
import { AsyncBoundary, AsyncError, AsyncLoading } from '@/components/states/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { DataTable } from '@/components/ui/AsyncState';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/Popover';
import { Textarea } from '@/components/ui/Textarea';
import { useAuth } from '@/contexts/AuthContext';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { useCustomers } from '@/hooks/useCustomers';
import { jsonArray, jsonBoolean, jsonNumber, jsonObject, jsonString } from '@/lib/json';
import { ptBrLabel } from '@/lib/ptBrLabels';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

interface Ticket {
  id: string;
  code: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  assignedTo: string | null;
  assignedName: string | null;
  responseDue: string | null;
  resolutionDue: string | null;
  escalateAt: string | null;
  createdAt: string;
  customerId: string | null;
  customerName: string;
  planId: string | null;
  planName: string | null;
  breached: boolean;
  escalated: boolean;
}

interface Queue {
  items: Ticket[];
  total: number;
  assignees: { id: string; name: string }[];
}

function parseQueue(value: import('@/types/supabase').Json | null): Queue {
  const root = jsonObject(value);
  return {
    total: jsonNumber(root?.total) || 0,
    items: jsonArray(root?.items).map(jsonObject).filter(Boolean).map((row) => ({
      id: jsonString(row?.id) || '',
      code: jsonString(row?.public_code) || '',
      subject: jsonString(row?.subject) || '',
      description: jsonString(row?.description) || '',
      category: jsonString(row?.category) || '',
      priority: jsonString(row?.priority) || 'normal',
      status: jsonString(row?.status) || 'open',
      assignedTo: jsonString(row?.assigned_to),
      assignedName: jsonString(row?.assigned_to_name),
      responseDue: jsonString(row?.response_due_at),
      resolutionDue: jsonString(row?.resolution_due_at),
      escalateAt: jsonString(row?.escalate_at),
      createdAt: jsonString(row?.created_at) || new Date(0).toISOString(),
      customerId: jsonString(row?.customer_id),
      customerName: jsonString(row?.customer_name) || 'Conta individual',
      planId: jsonString(row?.plan_id),
      planName: jsonString(row?.plan_name),
      breached: jsonBoolean(row?.sla_breached) || false,
      escalated: jsonBoolean(row?.escalated) || false,
    })),
    assignees: jsonArray(root?.assignees).map(jsonObject).filter(Boolean).map((row) => ({
      id: jsonString(row?.id) || '',
      name: jsonString(row?.name) || 'Staff',
    })),
  };
}

export function SupportPage() {
  const { can } = useAuth();
  const [view, setView] = useState<'board' | 'list' | 'metrics'>('board');
  const [search, setSearch] = useState('');
  const [customer, setCustomer] = useState('');
  const [plan, setPlan] = useState('');
  const [priority, setPriority] = useState('');
  const [status, setStatus] = useState('');
  const [assignee, setAssignee] = useState('');
  const [sla, setSla] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const customers = useCustomers('', '', 0, 100);
  const plans = useQuery({
    queryKey: ['support-plans'],
    queryFn: async () => {
      const { data, error } = await supabase.from('plans').select('id,name').neq('status', 'retired').order('name');
      if (error) throw error;
      return data;
    },
  });
  const query = useQuery({
    queryKey: ['support-queue', search, customer, plan, priority, status, assignee, sla],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('list_internal_support_queue', {
        p_search: search || undefined,
        p_customer_id: customer || undefined,
        p_plan_id: plan || undefined,
        p_priority: priority || undefined,
        p_status: status || undefined,
        p_assignee_id: assignee || undefined,
        p_sla: sla || undefined,
        p_limit: 100,
        p_offset: 0,
      });
      if (error) throw error;
      return parseQueue(data);
    },
  });
  const mutation = useAdministrativeMutation<{ id: string; action: string; value: string; message: string }, unknown>({
    mutationFn: async (value, operationId) => {
      const { data, error } = await supabase.rpc('mutate_internal_support_ticket', {
        p_ticket_id: value.id,
        p_action: value.action,
        p_value: value.value,
        p_message: value.message,
        p_operation_id: operationId,
      });
      if (error) throw error;
      return data;
    },
    invalidate: [['support-queue'], ['support-events'], ['audit-timeline'], ['internal-dashboard']],
  });

  const tickets = useMemo(() => query.data?.items ?? [], [query.data]);
  const summary = useMemo(() => supportSummary(tickets), [tickets]);
  const selected = tickets.find((item) => item.id === selectedId) || null;

  async function update(id: string, action: string, value = '', message = '') {
    const result = await mutation.mutateAsync({ id, action, value, message });
    if (!result.ok) throw new Error(result.error);
  }

  function clearFilters() {
    setSearch('');
    setCustomer('');
    setPlan('');
    setPriority('');
    setStatus('');
    setAssignee('');
    setSla('');
  }

  return (
    <section className="page-stack max-w-[1094px]">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-wide text-info-strong">Central de suporte</p>
          <h1 className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.025em]">Suporte</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Priorize chamados por risco de SLA e mantenha o contexto do cliente sempre visível.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <FilterPopover
            search={search}
            setSearch={setSearch}
            customer={customer}
            setCustomer={setCustomer}
            plan={plan}
            setPlan={setPlan}
            priority={priority}
            setPriority={setPriority}
            status={status}
            setStatus={setStatus}
            assignee={assignee}
            setAssignee={setAssignee}
            sla={sla}
            setSla={setSla}
            customers={customers.data?.items ?? []}
            plans={plans.data ?? []}
            assignees={query.data?.assignees ?? []}
            onClear={clearFilters}
          />
          <ViewToggle value={view} onChange={setView} />
        </div>
      </div>

      <AsyncBoundary
        loading={query.isLoading || customers.isLoading || plans.isLoading}
        error={query.error || customers.error || plans.error}
        onRetry={() => void query.refetch()}
        empty={Boolean(query.data && !tickets.length)}
        emptyTitle="Fila vazia"
        emptyDescription="Nenhum chamado corresponde aos filtros."
      >
        <section className="grid gap-4 lg:grid-cols-[repeat(3,minmax(0,1fr))_268px]" aria-label="Indicadores de suporte">
          <SupportMetric code="A" label="Abertos" value={summary.open.length} detail={`${query.data?.total ?? 0} na fila`} tone="info" />
          <SupportMetric code="P" label="Próximos do SLA" value={summary.nearSla.length} detail="ação imediata" tone="warning" />
          <SupportMetric code="C" label="Críticos" value={summary.critical.length} detail={`${summary.critical.filter((item) => item.escalated).length} escalados`} tone="danger" />
          <div className="hidden lg:block" />
        </section>

        {view === 'board' && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,810px)_260px]">
            <div>
              <h2 className="text-[17px] font-bold">Fila por prioridade</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                O layout separa risco, espera e trabalho ativo sem alterar o estado persistido.
              </p>
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                <TicketColumn title="Risco de SLA" tickets={summary.risk} tone="danger" onSelect={setSelectedId} />
                <TicketColumn title="Aguardando cliente" tickets={summary.waiting} tone="warning" onSelect={setSelectedId} />
                <TicketColumn title="Em atendimento" tickets={summary.inProgress} tone="info" onSelect={setSelectedId} />
              </div>
            </div>
            <SlaTower tickets={summary.open} />
          </div>
        )}

        {view === 'list' && (
          <TicketList tickets={tickets} onSelect={setSelectedId} canWrite={can('support.write')} />
        )}

        {view === 'metrics' && (
          <div className="grid gap-5 lg:grid-cols-2">
            <SlaTower tickets={summary.open} />
            <Card className="shadow-none">
              <CardContent className="p-6">
                <h2 className="text-[17px] font-bold">Distribuição da fila</h2>
                <dl className="mt-5 space-y-4">
                  <MetricRow label="Risco de SLA" value={summary.risk.length} />
                  <MetricRow label="Aguardando cliente" value={summary.waiting.length} />
                  <MetricRow label="Em atendimento" value={summary.inProgress.length} />
                  <MetricRow label="Total retornado" value={tickets.length} />
                </dl>
              </CardContent>
            </Card>
          </div>
        )}
      </AsyncBoundary>

      {selected && (
        <TicketDialog
          ticket={selected}
          assignees={query.data?.assignees || []}
          busy={mutation.isPending}
          canWrite={can('support.write')}
          onClose={() => setSelectedId(null)}
          onUpdate={update}
        />
      )}
    </section>
  );
}

function TicketColumn({
  title,
  tickets,
  tone,
  onSelect,
}: {
  title: string;
  tickets: Ticket[];
  tone: 'danger' | 'warning' | 'info';
  onSelect: (id: string) => void;
}) {
  const line = { danger: 'border-t-destructive', warning: 'border-t-warning', info: 'border-t-info-strong' };
  return (
    <section className={cn('min-h-[518px] rounded-[14px] border border-t-4 bg-secondary/60 p-3', line[tone])}>
      <div className="flex items-center justify-between px-1 py-2">
        <h3 className="text-[13px] font-bold">{title}</h3>
        <span className="rounded-full bg-card px-3 py-1 text-[11px] font-semibold">{tickets.length}</span>
      </div>
      <div className="mt-3 space-y-4">
        {tickets.slice(0, 4).map((ticket) => (
          <button
            key={ticket.id}
            className="w-full rounded-xl border bg-card p-4 text-left hover:border-primary/40"
            onClick={() => onSelect(ticket.id)}
          >
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-[10px] font-semibold text-muted-foreground">{ticket.code}</span>
              <StatusBadge value={ticket.priority} />
            </div>
            <p className="mt-4 text-xs font-semibold">{ticket.customerName}</p>
            <p className="mt-2 text-[13px] leading-5">{ticket.subject}</p>
            <div className="mt-5 flex items-center gap-3">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-info-soft text-[9px] font-bold text-info-strong">
                {initials(ticket.assignedName)}
              </span>
              <span className={cn('text-[10px] font-semibold', ticket.breached ? 'text-destructive' : 'text-muted-foreground')}>
                {ticket.breached ? 'SLA violado' : timeUntil(ticket.responseDue)}
              </span>
            </div>
          </button>
        ))}
        {!tickets.length && <p className="px-2 py-8 text-center text-xs text-muted-foreground">Nenhum chamado nesta etapa.</p>}
      </div>
    </section>
  );
}

function SlaTower({ tickets }: { tickets: Ticket[] }) {
  const healthy = tickets.filter((ticket) => !ticket.breached).length;
  const percent = tickets.length ? Math.round(healthy * 100 / tickets.length) : 100;
  const priorities = ['critical', 'high', 'normal', 'low'];
  const categories = Array.from(new Set(tickets.filter((ticket) => ticket.priority === 'critical').map((ticket) => ticket.category).filter(Boolean)));
  return (
    <aside className="rounded-[14px] bg-ink-panel p-6 text-white">
      <p className="text-[10px] font-bold uppercase text-warm">Torre de SLA</p>
      <strong className="mt-4 block text-[30px]">{percent}%</strong>
      <p className="text-[11px] text-white/60">da fila aberta dentro do prazo</p>
      <dl className="mt-7">
        {priorities.map((priority) => {
          const matching = tickets.filter((ticket) => ticket.priority === priority);
          return (
            <div key={priority} className="grid grid-cols-[1fr_auto] border-b border-white/10 py-4 text-xs first:pt-0">
              <dt className="font-semibold">{ptBrLabel(priority)}</dt>
              <dd className="font-semibold">{matching.length}</dd>
              <dd className="col-span-2 mt-2 text-[10px] text-white/50">{minimumDue(matching)}</dd>
            </div>
          );
        })}
      </dl>
      <div className="mt-7">
        <p className="text-xs font-semibold text-warm">Insight da fila</p>
        <p className="mt-3 text-xs leading-5 text-white/80">
          {categories.length
            ? `Chamados críticos concentrados em ${categories.map((item) => ptBrLabel(item)).join(', ')}.`
            : 'Nenhuma concentração crítica foi identificada nos dados retornados.'}
        </p>
      </div>
    </aside>
  );
}

function TicketList({ tickets, onSelect, canWrite }: { tickets: Ticket[]; onSelect: (id: string) => void; canWrite: boolean }) {
  return (
    <DataTable headers={['Chamado', 'Cliente/Plano', 'Prioridade', 'Responsável', 'Prazos', 'Status']} minWidth={980}>
      {tickets.map((ticket) => (
        <tr
          key={ticket.id}
          className={cn('cursor-pointer border-t hover:bg-secondary/60', ticket.breached && 'bg-danger-soft/50')}
          onClick={() => onSelect(ticket.id)}
          tabIndex={0}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              onSelect(ticket.id);
            }
          }}
        >
          <td className="p-3">
            <span className="font-mono text-xs text-muted-foreground">{ticket.code}</span>
            <p className="font-semibold">{ticket.subject}</p>
            {ticket.escalated && <span className="text-xs font-bold text-destructive"><AlertTriangle className="mr-1 inline h-3 w-3" />Escalonado</span>}
          </td>
          <td className="p-3"><strong>{ticket.customerName}</strong><p className="text-xs text-muted-foreground">{ticket.planName || 'Sem plano'}</p></td>
          <td className="p-3"><StatusBadge value={ticket.priority} /></td>
          <td className="p-3">{ticket.assignedName || 'Não atribuído'}</td>
          <td className={cn('p-3 text-xs', ticket.breached && 'font-bold text-destructive')}>Resposta: {date(ticket.responseDue)}<br />Resolução: {date(ticket.resolutionDue)}</td>
          <td className="p-3"><StatusBadge value={ticket.status} />{!canWrite && <span className="sr-only">Somente leitura</span>}</td>
        </tr>
      ))}
    </DataTable>
  );
}

function FilterPopover({
  search,
  setSearch,
  customer,
  setCustomer,
  plan,
  setPlan,
  priority,
  setPriority,
  status,
  setStatus,
  assignee,
  setAssignee,
  sla,
  setSla,
  customers,
  plans,
  assignees,
  onClear,
}: {
  search: string;
  setSearch: (value: string) => void;
  customer: string;
  setCustomer: (value: string) => void;
  plan: string;
  setPlan: (value: string) => void;
  priority: string;
  setPriority: (value: string) => void;
  status: string;
  setStatus: (value: string) => void;
  assignee: string;
  setAssignee: (value: string) => void;
  sla: string;
  setSla: (value: string) => void;
  customers: { customer_id: string; display_name: string }[];
  plans: { id: string; name: string }[];
  assignees: { id: string; name: string }[];
  onClear: () => void;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline"><Filter />Filtros</Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(360px,calc(100vw-2rem))]">
        <p className="font-semibold">Filtros da fila</p>
        <div className="mt-4 space-y-3">
          <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Código ou assunto" aria-label="Buscar chamado" />
          <FilterSelect label="Cliente" value={customer} onChange={setCustomer}>
            <option value="">Todos os clientes</option>
            {customers.map((item) => <option key={item.customer_id} value={item.customer_id}>{item.display_name}</option>)}
          </FilterSelect>
          <FilterSelect label="Plano" value={plan} onChange={setPlan}>
            <option value="">Todos os planos</option>
            {plans.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </FilterSelect>
          <div className="grid grid-cols-2 gap-3">
            <FilterSelect label="Prioridade" value={priority} onChange={setPriority}>
              <option value="">Prioridades</option>
              {['low', 'normal', 'high', 'critical'].map((value) => <option key={value} value={value}>{ptBrLabel(value)}</option>)}
            </FilterSelect>
            <FilterSelect label="Status" value={status} onChange={setStatus}>
              <option value="">Status</option>
              {['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'].map((value) => <option key={value} value={value}>{ptBrLabel(value)}</option>)}
            </FilterSelect>
          </div>
          <FilterSelect label="Responsável" value={assignee} onChange={setAssignee}>
            <option value="">Responsáveis</option>
            {assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </FilterSelect>
          <FilterSelect label="SLA" value={sla} onChange={setSla}>
            <option value="">Todos os SLAs</option>
            <option value="healthy">Saudável</option>
            <option value="breached">Violado</option>
            <option value="escalated">Escalonado</option>
          </FilterSelect>
          <Button variant="ghost" className="w-full" onClick={onClear}>Limpar filtros</Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

function ViewToggle({ value, onChange }: { value: 'board' | 'list' | 'metrics'; onChange: (value: 'board' | 'list' | 'metrics') => void }) {
  const views = [['board', 'Quadro'], ['list', 'Lista'], ['metrics', 'Métricas']] as const;
  return (
    <div className="inline-flex rounded-full border bg-card p-1" aria-label="Visualização da fila">
      {views.map(([key, label]) => (
        <button
          key={key}
          className={cn('h-8 rounded-full px-4 text-[11px] font-semibold', value === key ? 'bg-ink text-white' : 'text-muted-foreground')}
          onClick={() => onChange(key)}
          aria-pressed={value === key}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function SupportMetric({ code, label, value, detail, tone }: { code: string; label: string; value: number; detail: string; tone: 'info' | 'warning' | 'danger' }) {
  const tones = {
    info: 'bg-info-soft text-info-strong',
    warning: 'bg-warning-soft text-warning',
    danger: 'bg-danger-soft text-destructive',
  };
  return (
    <Card className="min-h-[104px] shadow-none">
      <CardContent className="flex items-center gap-4 p-4">
        <span className={cn('grid h-9 w-9 place-items-center rounded-[10px] text-xs font-bold', tones[tone])}>{code}</span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <div className="mt-1 flex items-baseline gap-5">
            <strong className="text-[22px]">{value}</strong>
            <span className={cn('text-[10px] font-semibold', tone === 'danger' ? 'text-destructive' : tone === 'warning' ? 'text-warning' : 'text-info-strong')}>{detail}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function TicketDialog({
  ticket,
  assignees,
  busy,
  canWrite,
  onClose,
  onUpdate,
}: {
  ticket: Ticket;
  assignees: { id: string; name: string }[];
  busy: boolean;
  canWrite: boolean;
  onClose: () => void;
  onUpdate: (id: string, action: string, value?: string, message?: string) => Promise<void>;
}) {
  const [message, setMessage] = useState('');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function act(action: string, value = '', text = '') {
    setError(null);
    try {
      await onUpdate(ticket.id, action, value, text);
      if (action === 'message') setMessage('');
      if (action === 'note') setNote('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Operação não concluída.');
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <p className="font-mono text-xs text-muted-foreground">{ticket.code}</p>
          <DialogTitle>{ticket.subject}</DialogTitle>
          <DialogDescription>{ticket.customerName} · {ticket.planName || 'Sem plano'}</DialogDescription>
        </DialogHeader>
        <p className="whitespace-pre-wrap text-sm">{ticket.description}</p>
        <div className="grid gap-3 sm:grid-cols-3">
          <FilterSelect value={ticket.status} onChange={(value) => void act('status', value)} label="Status" disabled={busy || !canWrite}>
            {['open', 'in_progress', 'waiting_customer', 'resolved', 'closed'].map((value) => <option key={value} value={value}>{ptBrLabel(value)}</option>)}
          </FilterSelect>
          <FilterSelect value={ticket.priority} onChange={(value) => void act('priority', value)} label="Prioridade" disabled={busy || !canWrite}>
            {['low', 'normal', 'high', 'critical'].map((value) => <option key={value} value={value}>{ptBrLabel(value)}</option>)}
          </FilterSelect>
          <FilterSelect value={ticket.assignedTo || ''} onChange={(value) => void act('assignee', value)} label="Responsável" disabled={busy || !canWrite}>
            <option value="">Não atribuído</option>
            {assignees.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </FilterSelect>
        </div>
        <div className={cn('rounded-xl border p-4 text-sm', ticket.breached || ticket.escalated ? 'border-destructive/20 bg-danger-soft text-destructive' : 'bg-secondary')}>
          <strong>SLA:</strong> resposta {date(ticket.responseDue)} · resolução {date(ticket.resolutionDue)} · escalonamento {date(ticket.escalateAt)}
        </div>
        {canWrite && (
          <div className="grid gap-4 md:grid-cols-2">
            <Composer icon={<Send />} title="Mensagem compartilhada" value={message} onChange={setMessage} onSend={() => void act('message', '', message)} disabled={busy} />
            <Composer icon={<StickyNote />} title="Nota interna" value={note} onChange={setNote} onSend={() => void act('note', '', note)} disabled={busy} />
          </div>
        )}
        {error && <p className="rounded-lg bg-danger-soft p-3 text-sm text-destructive" role="alert">{error}</p>}
        <SupportEvents ticketId={ticket.id} />
      </DialogContent>
    </Dialog>
  );
}

function SupportEvents({ ticketId }: { ticketId: string }) {
  const query = useQuery({
    queryKey: ['support-events', ticketId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('support_ticket_events')
        .select('id,event_type,message,metadata,created_at')
        .eq('ticket_id', ticketId)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
  return (
    <div className="border-t pt-4">
      <h3 className="mb-3 font-bold">Histórico</h3>
      {query.isLoading ? <AsyncLoading label="Carregando histórico…" /> : query.isError ? <AsyncError error={query.error} /> : !query.data?.length ? (
        <p className="text-sm text-muted-foreground">Sem eventos.</p>
      ) : (
        <ol className="space-y-3">
          {query.data.map((event) => (
            <li key={event.id} className="rounded-lg bg-secondary p-3 text-sm">
              <div className="flex justify-between gap-3">
                <strong>{ptBrLabel(event.event_type)}</strong>
                <time className="text-xs text-muted-foreground">{new Date(event.created_at).toLocaleString('pt-BR')}</time>
              </div>
              {event.message && <p className="mt-1 whitespace-pre-wrap">{event.message}</p>}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Composer({ icon, title, value, onChange, onSend, disabled }: { icon: ReactNode; title: string; value: string; onChange: (value: string) => void; onSend: () => void; disabled: boolean }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="flex items-center gap-2 text-sm font-bold [&_svg]:h-4 [&_svg]:w-4">{icon}{title}</p>
      <Textarea value={value} onChange={(event) => onChange(event.target.value)} rows={4} className="mt-2" />
      <Button size="sm" className="mt-2" disabled={disabled || value.trim().length < 2} onClick={onSend}>Enviar</Button>
    </div>
  );
}

function FilterSelect({ value, onChange, label, children, disabled }: { value: string; onChange: (value: string) => void; label: string; children: ReactNode; disabled?: boolean }) {
  return (
    <div className="space-y-1">
      <Label className="sr-only">{label}</Label>
      <select
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        aria-label={label}
        className="h-10 w-full rounded-lg border bg-background px-3 text-sm disabled:bg-secondary"
      >
        {children}
      </select>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: number }) {
  return <div className="flex justify-between border-b pb-3 last:border-0"><dt className="text-muted-foreground">{label}</dt><dd className="font-bold">{value}</dd></div>;
}

function supportSummary(items: Ticket[]) {
  const open = items.filter((ticket) => !['resolved', 'closed'].includes(ticket.status));
  const risk = open.filter((ticket) => ticket.breached || ticket.escalated);
  const waiting = open.filter((ticket) => ticket.status === 'waiting_customer' && !risk.includes(ticket));
  const inProgress = open.filter((ticket) => !risk.includes(ticket) && !waiting.includes(ticket));
  const nearSla = open.filter((ticket) => {
    if (!ticket.responseDue || ticket.breached) return false;
    const remaining = new Date(ticket.responseDue).getTime() - Date.now();
    return remaining >= 0 && remaining <= 4 * 60 * 60 * 1000;
  });
  return {
    open,
    risk,
    waiting,
    inProgress,
    nearSla,
    critical: open.filter((ticket) => ticket.priority === 'critical'),
  };
}

function minimumDue(tickets: Ticket[]) {
  const remaining = tickets
    .map((ticket) => ticket.responseDue ? new Date(ticket.responseDue).getTime() - Date.now() : Number.NaN)
    .filter(Number.isFinite)
    .sort((left, right) => left - right)[0];
  if (remaining === undefined) return 'sem prazo retornado';
  if (remaining <= 0) return 'prazo vencido';
  return `menor prazo · ${formatDuration(remaining)}`;
}

function timeUntil(value: string | null) {
  if (!value) return 'Prazo não informado';
  const remaining = new Date(value).getTime() - Date.now();
  if (remaining <= 0) return 'Prazo vencido';
  return `${formatDuration(remaining)} restantes`;
}

function formatDuration(milliseconds: number) {
  const minutes = Math.max(1, Math.round(milliseconds / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours < 24) return `${hours}h${remainder ? ` ${remainder}m` : ''}`;
  return `${Math.floor(hours / 24)}d ${hours % 24}h`;
}

function initials(value: string | null) {
  return value
    ?.split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase() || '—';
}

function date(value: string | null) {
  return value ? new Date(value).toLocaleString('pt-BR') : '—';
}
