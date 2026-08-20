import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ShieldCheck, UserCog } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { usePortalAuth } from '@/contexts/PortalAuthContext';
import { fetchPortalWorkspace, portalRestrictionMessage } from '@/lib/portal';
import { supabase } from '@/lib/supabase';

type TeamItem = Record<string, unknown>;

export function PortalTeamPage() {
  const { access, can } = usePortalAuth();
  const query = useQuery({
    queryKey: ['portal', 'workspace', 'equipe', access?.userId, access?.accountKind, access?.organizationId ?? null],
    queryFn: () => fetchPortalWorkspace('equipe'),
  });
  const [selected, setSelected] = useState<TeamItem | null>(null);
  const [role, setRole] = useState('agent');
  const [status, setStatus] = useState('active');
  const [reason, setReason] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const hasManagePermission = can('team.manage');
  const subscriptionBlocks = access ? !access.creationAllowed : false;
  const mayManage = hasManagePermission && !subscriptionBlocks;
  const manageTriggerRef = useRef<HTMLButtonElement | null>(null);
  const manageTitleRef = useRef<HTMLHeadingElement>(null);
  const pageTitleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!selected) return;
    setRole(String(selected.subtitle ?? 'agent'));
    setStatus(String(selected.status ?? 'active'));
    setReason('');
    setConfirmation('');
    window.setTimeout(() => manageTitleRef.current?.focus(), 0);
  }, [selected]);

  useEffect(() => {
    if (mayManage || !selected) return;
    setSelected(null);
    window.setTimeout(() => pageTitleRef.current?.focus(), 0);
  }, [mayManage, selected]);

  function selectMember(item: TeamItem, trigger: HTMLButtonElement) {
    manageTriggerRef.current = trigger;
    setSelected(item);
  }

  function closeManagement() {
    setSelected(null);
    window.setTimeout(() => manageTriggerRef.current?.focus(), 0);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!selected) return;
    if (!mayManage) {
      setErrorMessage('Sua permissão para gerenciar a equipe não está disponível neste momento.');
      return;
    }
    setSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    const { error } = await supabase.rpc('portal_update_organization_member', {
      p_member_id: String(selected.id),
      p_role: role,
      p_status: status,
      p_reason: reason,
      p_confirmation: confirmation,
    });
    setSubmitting(false);
    if (error) {
      setErrorMessage('A alteração não foi concluída. Verifique a confirmação, a justificativa e as regras de coordenação.');
      return;
    }
    closeManagement();
    setSuccessMessage('Membro atualizado e ação registrada na auditoria.');
    void query.refetch();
  }

  return (
    <div className="page-stack">
      {hasManagePermission && subscriptionBlocks && (
        <p className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-foreground" role="status">
          A gestão de equipe está em consulta: {portalRestrictionMessage(access?.restrictionCause ?? null)} Você pode consultar a equipe, mas alterações de papel e status voltam após a regularização.
        </p>
      )}
      <p className="rounded-md border border-border bg-secondary p-3 text-sm text-muted-foreground" role="status">{mayManage ? 'Selecione uma pessoa para revisar papel e status; nenhuma alteração ocorre sem confirmação.' : 'Você está em modo de consulta; papéis e status só podem ser alterados por um coordenador.'}</p>
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-primary">Administração municipal</p>
        <h1 ref={pageTitleRef} tabIndex={-1} className="mt-2 text-3xl font-semibold">Equipe</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Supervisores consultam a equipe do escopo. Coordenadores também podem alterar papel ou status com confirmação auditável.
        </p>
      </header>
      {successMessage && <p className="rounded-md border bg-card p-3 text-sm" role="status">{successMessage}</p>}
      {errorMessage && <p className="rounded-md border border-destructive/30 bg-destructive-soft p-3 text-sm text-destructive" role="alert">{errorMessage}</p>}
      <Card>
        <CardHeader><CardTitle>Pessoas da organização</CardTitle></CardHeader>
        <CardContent>
          {query.isLoading && <p className="text-sm text-muted-foreground">Carregando equipe…</p>}
          {query.isError && <div className="space-y-3 text-sm text-destructive" role="alert"><p>Não foi possível carregar a equipe.</p><Button variant="outline" size="sm" onClick={() => void query.refetch()}>Tentar novamente</Button></div>}
          <ul className="divide-y">
            {query.data?.items.map((item) => (
              <li key={String(item.id)} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold">{String(item.title)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge variant="outline">{roleLabel(String(item.subtitle))}</Badge>
                    <Badge>{statusLabel(String(item.status))}</Badge>
                  </div>
                </div>
                {mayManage && String(item.user_id) !== access?.userId && (
                  <Button variant="outline" aria-expanded={String(selected?.id) === String(item.id)} aria-controls="portal-team-management" onClick={(event) => selectMember(item, event.currentTarget)}><UserCog />Gerenciar</Button>
                )}
              </li>
            ))}
          </ul>
          {query.data?.items.length === 0 && <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">Nenhum membro encontrado.</p>}
        </CardContent>
      </Card>
      {selected && mayManage && (
        <Card id="portal-team-management">
          <CardHeader><CardTitle ref={manageTitleRef} tabIndex={-1} className="flex items-center gap-2"><ShieldCheck />Confirmar alteração de alto impacto</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={submit}>
              <p className="text-sm text-muted-foreground">Alterando {String(selected.title)}. O último coordenador ativo não pode ser removido ou rebaixado.</p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-medium">Papel
                  <select className="mt-2 h-11 w-full rounded-md border bg-card px-3" value={role} onChange={(event) => setRole(event.target.value)}>
                    <option value="agent">Agente</option>
                    <option value="supervisor">Supervisor</option>
                    {access?.role === 'master' && <option value="admin">Administrador</option>}
                  </select>
                </label>
                <label className="text-sm font-medium">Status
                  <select className="mt-2 h-11 w-full rounded-md border bg-card px-3" value={status} onChange={(event) => setStatus(event.target.value)}>
                    <option value="active">Ativo</option>
                    <option value="suspended">Suspenso</option>
                    <option value="removed">Removido</option>
                  </select>
                </label>
              </div>
              <label className="text-sm font-medium">Justificativa
                <textarea className="mt-2 min-h-24 w-full rounded-md border bg-card p-3 text-sm" value={reason} onChange={(event) => setReason(event.target.value)} minLength={10} required />
              </label>
              <label className="text-sm font-medium">Digite CONFIRMAR
                <Input className="mt-2" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} autoComplete="off" required />
              </label>
              <div className="flex flex-wrap gap-2">
                <Button disabled={!mayManage || submitting || confirmation !== 'CONFIRMAR' || reason.trim().length < 10}>{submitting ? 'Salvando…' : 'Aplicar alteração'}</Button>
                <Button type="button" variant="outline" onClick={closeManagement}>Cancelar</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function roleLabel(value: string) {
  return ({ master: 'Master', admin: 'Administrador', supervisor: 'Supervisor', agent: 'Agente' } as Record<string, string>)[value] ?? value;
}

function statusLabel(value: string) {
  return ({ active: 'Ativo', suspended: 'Suspenso', removed: 'Removido', invited: 'Convidado' } as Record<string, string>)[value] ?? value;
}
