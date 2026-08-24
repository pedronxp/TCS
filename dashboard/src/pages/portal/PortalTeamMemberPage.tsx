import { useEffect, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace, portalRestrictionMessage } from '@/lib/portal';
import { supabase } from '@/lib/supabase';
import { roleLabel, statusLabel } from '@/pages/portal/PortalTeamPage';

export function PortalTeamMemberPage() {
  const { memberId } = useParams();
  const navigate = useNavigate();
  const { access, can } = usePortalAuth();
  const query = useQuery({ queryKey: ['portal', 'workspace', 'equipe', access?.organizationId], queryFn: () => fetchPortalWorkspace('equipe') });
  const member = query.data?.items.find((item) => String(item.id) === memberId);
  const mayManage = can('team.manage') && Boolean(access?.creationAllowed) && Boolean(member) && String(member?.user_id) !== access?.userId;
  const [role, setRole] = useState('agent');
  const [status, setStatus] = useState('active');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (member) { setRole(String(member.subtitle ?? 'agent')); setStatus(String(member.status ?? 'active')); } }, [member]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!member || !mayManage) return;
    setSubmitting(true); setError(null); setMessage(null);
    const result = await supabase.rpc('portal_update_organization_member', { p_member_id: String(member.id), p_role: role, p_status: status, p_reason: reason, p_confirmation: confirmation });
    setSubmitting(false);
    if (result.error) { setError('A alteração não foi concluída. Revise a justificativa, a confirmação e as regras de coordenação.'); return; }
    setMessage('Membro atualizado. A alteração foi enviada à Caixa de mensagens e registrada na auditoria.');
    setReason(''); setConfirmation(''); void query.refetch();
  }

  return (
    <div className="page-stack mx-auto max-w-[850px]">
      <header><Link to="/portal/municipal/equipe" className="inline-flex items-center gap-1 text-xs font-semibold text-primary"><ArrowLeft className="h-4 w-4" />Voltar para equipe</Link><h1 className="mt-2 text-2xl font-semibold">{member ? String(member.title) : 'Pessoa da equipe'}</h1><p className="mt-1 text-sm text-muted-foreground">Perfil, situação e permissões dentro desta organização.</p></header>
      {query.isLoading && <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando pessoa…</CardContent></Card>}
      {query.isError && <Card><CardContent className="p-6 text-sm text-destructive">Não foi possível carregar a equipe.</CardContent></Card>}
      {!query.isLoading && !query.isError && !member && <Card><CardContent className="p-6 text-sm">Pessoa não encontrada nesta organização.</CardContent></Card>}
      {member && <>
        <Card><CardHeader><CardTitle>Resumo de acesso</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2"><Badge variant="outline">{roleLabel(String(member.subtitle))}</Badge><Badge>{statusLabel(String(member.status))}</Badge>{String(member.user_id) === access?.userId && <Badge variant="secondary">Seu acesso</Badge>}</CardContent></Card>
        {message && <p className="rounded-md border border-success/25 bg-success-soft p-3 text-sm" role="status">{message}</p>}
        {error && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{error}</p>}
        <Card><CardHeader><CardTitle className="flex items-center gap-2"><ShieldCheck />Permissões e situação</CardTitle></CardHeader><CardContent>
          {!access?.creationAllowed && <p className="mb-4 rounded-md border border-warning/30 bg-warning-soft p-3 text-sm">Gestão em consulta: {portalRestrictionMessage(access?.restrictionCause ?? null)}</p>}
          {!mayManage ? <p className="text-sm text-muted-foreground">Você pode consultar este perfil. Alterações exigem permissão de gestão e assinatura regular.</p> : <form className="grid gap-4" onSubmit={submit}>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Papel<select className="mt-2 h-11 w-full rounded-md border bg-card px-3" value={role} onChange={(event) => setRole(event.target.value)}><option value="agent">Agente</option><option value="supervisor">Supervisor</option>{access?.role === 'master' && <option value="admin">Administrador</option>}</select></label><label className="text-sm font-medium">Situação<select className="mt-2 h-11 w-full rounded-md border bg-card px-3" value={status} onChange={(event) => setStatus(event.target.value)}><option value="active">Ativo</option><option value="suspended">Suspenso</option><option value="removed">Removido</option></select></label></div>
            <label className="text-sm font-medium">Justificativa<textarea className="mt-2 min-h-24 w-full rounded-md border bg-card p-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} required placeholder="Explique por que o acesso será alterado" /></label>
            <label className="text-sm font-medium">Confirmação<Input className="mt-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Digite CONFIRMAR" autoComplete="off" required /></label>
            <div className="flex gap-2"><Button disabled={submitting || confirmation !== 'CONFIRMAR' || reason.trim().length < 10}>{submitting ? 'Salvando…' : 'Aplicar alteração'}</Button><Button type="button" variant="outline" onClick={() => navigate('/portal/municipal/equipe')}>Cancelar</Button></div>
          </form>}
        </CardContent></Card>
      </>}
    </div>
  );
}
