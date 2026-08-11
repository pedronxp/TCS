import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Headphones, Plus } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

export function PortalSupportPage() {
  const { access, can } = usePortalAuth();
  const mayCreate = can('support.create');
  const query = useQuery({
    queryKey: ['portal', 'workspace', 'suporte', access?.userId, access?.accountKind, access?.organizationId ?? null, access?.role ?? null],
    queryFn: () => fetchPortalWorkspace('suporte'),
    enabled: Boolean(access),
  });
  const [open, setOpen] = useState(false);
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
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Atendimento</p><h1 ref={pageTitleRef} tabIndex={-1} className="mt-2 text-3xl font-semibold">Suporte</h1><p className="mt-2 text-sm text-muted-foreground">Solicitações do seu escopo, protegidas pelo SLA do plano.</p></div>{mayCreate && <Button ref={triggerRef} aria-expanded={open} aria-controls="portal-support-form" onClick={() => open ? closeForm() : setOpen(true)}><Plus />{open ? 'Fechar formulário' : 'Abrir chamado'}</Button>}</header>
      {!mayCreate && <p className="rounded-md border bg-secondary p-3 text-sm text-muted-foreground" role="status">Seu acesso permite consultar chamados, mas não abrir novas solicitações.</p>}
      {successMessage && <p className="rounded-md border bg-card p-3 text-sm" role="status">{successMessage}</p>}
      {errorMessage && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{errorMessage}</p>}
      {open && mayCreate && <Card id="portal-support-form"><CardHeader><CardTitle ref={formTitleRef} tabIndex={-1} className="flex items-center gap-2"><Headphones />Novo chamado</CardTitle></CardHeader><CardContent><form className="grid gap-4" onSubmit={submit}><div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Categoria<select className="mt-2 h-11 w-full rounded-md border bg-card px-3" value={category} onChange={(event) => setCategory(event.target.value)}><option value="operacao">Operação</option><option value="tecnico">Técnico</option><option value="financeiro">Financeiro</option></select></label><label className="text-sm font-medium">Prioridade<select className="mt-2 h-11 w-full rounded-md border bg-card px-3" value={priority} onChange={(event) => setPriority(event.target.value)}><option value="low">Baixa</option><option value="normal">Normal</option><option value="high">Alta</option><option value="critical">Crítica</option></select></label></div><label className="text-sm font-medium">Assunto<Input className="mt-2" value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={200} required /></label><label className="text-sm font-medium">Descrição<textarea className="mt-2 min-h-32 w-full rounded-md border bg-card p-3 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} required /></label><div className="flex gap-2"><Button disabled={submitting || !mayCreate}>{submitting ? 'Enviando…' : 'Enviar chamado'}</Button><Button type="button" variant="outline" onClick={closeForm}>Cancelar</Button></div></form></CardContent></Card>}
      <Card><CardHeader><CardTitle>Chamados</CardTitle></CardHeader><CardContent>{query.isLoading && <p className="text-sm text-muted-foreground">Carregando chamados…</p>}{query.isError && <div className="space-y-3 text-sm text-destructive" role="alert"><p>Não foi possível carregar os chamados.</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}<ul className="divide-y">{query.data?.items.map((item) => <li key={String(item.id)} className="flex items-center justify-between gap-4 py-4"><div><p className="text-sm font-semibold">{String(item.title)}</p><p className="mt-1 text-xs text-muted-foreground">{String(item.subtitle)}</p></div><Badge>{String(item.status)}</Badge></li>)}</ul>{query.data?.items.length === 0 && <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum chamado aberto.</p>}</CardContent></Card>
    </div>
  );
}
