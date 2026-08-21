import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MoreHorizontal, Plus, ShieldCheck } from 'lucide-react';
import { StatusBadge } from '@/components/domain/Badges';
import { AsyncBoundary } from '@/components/states/AsyncBoundary';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { HighRiskDialog } from '@/components/ui/HighRiskDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/Select';
import { useAuth } from '@/contexts/AuthContext';
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';
import type { InternalPermission } from '@/types/internal';

interface Draft {
  userId: string;
  role: string;
  status: string;
}

interface StaffRow {
  user_id: string;
  role: string;
  status: string;
  display_name: string | null;
  created_at: string;
  updated_at: string;
}

type PermissionEffect = 'grant' | 'revoke';

interface PermissionDraft {
  userId: string;
  displayName: string | null;
  overrides: Partial<Record<InternalPermission, PermissionEffect>>;
}

const permissionGroups: ReadonlyArray<{ label: string; permissions: ReadonlyArray<readonly [InternalPermission, string]> }> = [
  { label: 'Console e clientes', permissions: [
    ['console.read', 'Acesso ao console'], ['dashboard.executive.read', 'Visão executiva'], ['dashboard.technical.read', 'Visão técnica'],
    ['customer.read', 'Consultar clientes'], ['customer.sensitive.read', 'Ver dados sensíveis'], ['customer.sensitive.request', 'Solicitar dados sensíveis'], ['customer.write', 'Editar clientes'],
  ] },
  { label: 'Operação e negócio', permissions: [
    ['commercial.read', 'Consultar comercial'], ['commercial.write', 'Alterar planos e assinaturas'], ['support.read', 'Consultar suporte'], ['support.write', 'Responder suporte'],
    ['session.read', 'Consultar sessões'], ['session.terminate', 'Encerrar sessões'], ['protocol.read', 'Consultar protocolos'], ['protocol.rotate', 'Rotacionar protocolos'],
  ] },
  { label: 'Governança e segurança', permissions: [
    ['staff.read', 'Consultar equipe interna'], ['staff.manage', 'Gerenciar equipe interna'], ['audit.read', 'Consultar auditoria'],
    ['account.approve', 'Aprovar contas'], ['account.lock', 'Bloquear contas'], ['account.recover_invite', 'Recuperar convite de conta'],
    ['token.manage', 'Gerenciar tokens'], ['notification.manage', 'Enviar avisos'],
  ] },
  { label: 'Técnico', permissions: [
    ['technical.read', 'Consultar dados técnicos'], ['technical.write', 'Alterar configurações técnicas'], ['build.request', 'Solicitar build'], ['build.approve', 'Aprovar build'],
    ['configuration.prepare', 'Preparar configuração'], ['configuration.publish', 'Publicar configuração'],
  ] },
];

export function StaffPage() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [permissionDraft, setPermissionDraft] = useState<PermissionDraft | null>(null);
  const [confirmingPermissions, setConfirmingPermissions] = useState(false);
  const { user, profile, can } = useAuth();
  const query = useQuery({
    queryKey: ['internal-staff', user?.id, profile?.role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('internal_staff')
        .select('user_id,role,status,display_name,created_at,updated_at')
        .order('created_at');
      if (error) throw error;
      return data satisfies StaffRow[];
    },
  });
  const mutation = useAdministrativeMutation<{ draft: Draft; reason: string }, unknown>({
    mutationFn: async (input, operationId) => {
      const { data, error } = await supabase.rpc('manage_internal_staff', {
        p_user_id: input.draft.userId,
        p_role: input.draft.role,
        p_status: input.draft.status,
        p_reason: input.reason,
        p_operation_id: operationId,
      });
      if (error) throw error;
      return data;
    },
    invalidate: [['internal-staff'], ['audit-timeline']],
  });
  const permissionOverrides = useQuery({
    queryKey: ['internal-staff-permission-overrides', user?.id, profile?.role],
    queryFn: async () => {
      const { data, error } = await (supabase.rpc as (fn: string, args?: Record<string, never>) => PromiseLike<{
        data: Array<{ staff_user_id: string; permission: InternalPermission; effect: PermissionEffect }> | null;
        error: { message: string } | null;
      }>)('list_internal_staff_permission_overrides');
      if (error) throw error;
      return data ?? [];
    },
    enabled: can('staff.manage'),
  });
  const permissionMutation = useAdministrativeMutation<{ draft: PermissionDraft; reason: string }, unknown>({
    mutationFn: async (input, operationId) => {
      const entries = Object.entries(input.draft.overrides) as Array<[InternalPermission, PermissionEffect]>;
      const { data, error } = await (supabase.rpc as (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { message: string } | null }>)('manage_internal_staff_permissions', {
        p_user_id: input.draft.userId,
        p_grants: entries.filter(([, effect]) => effect === 'grant').map(([permission]) => permission),
        p_revokes: entries.filter(([, effect]) => effect === 'revoke').map(([permission]) => permission),
        p_reason: input.reason,
        p_operation_id: operationId,
      });
      if (error) throw error;
      return data;
    },
    invalidate: [['internal-staff-permission-overrides'], ['audit-timeline']],
  });

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const stats = useMemo(() => staffStats(rows), [rows]);

  function openNewMember() {
    setDraft({ userId: '', role: 'developer', status: 'active' });
    setConfirming(false);
  }

  function openPermissions(member: StaffRow) {
    const overrides = Object.fromEntries(
      (permissionOverrides.data ?? [])
        .filter((item) => item.staff_user_id === member.user_id)
        .map((item) => [item.permission, item.effect]),
    ) as PermissionDraft['overrides'];
    setPermissionDraft({ userId: member.user_id, displayName: member.display_name, overrides });
    setConfirmingPermissions(false);
  }

  return (
    <section className="page-stack max-w-[1094px]">
      <form
        id="staff-create-form"
        className="hidden"
        onSubmit={(event) => {
          event.preventDefault();
          openNewMember();
        }}
      />

      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-primary">Organização interna</p>
        <h1 className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.035em]">Pessoas e acessos</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Papéis internos, postura de acesso e responsabilidade operacional. Mudanças em Owner ou Developer são de alto risco: exigem MFA e justificativa auditada.
        </p>
        <Button className="mt-4 sm:hidden" onClick={openNewMember}>
          <Plus />
          Adicionar membro
        </Button>
      </div>

      <AsyncBoundary
        loading={query.isLoading}
        error={query.error}
        onRetry={() => void query.refetch()}
        empty={Boolean(query.data && !query.data.length)}
        emptyTitle="Sem equipe interna"
        emptyDescription="Nenhum perfil interno foi cadastrado."
      >
        <section className="grid gap-7 rounded-2xl border border-border/80 bg-card p-6 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end shadow-sm">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Postura de acesso</p>
            <h2 className="mt-3 text-2xl font-bold tracking-[-0.03em]">
              {stats.active} {stats.active === 1 ? 'pessoa conectada' : 'pessoas conectadas'} à operação
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Visão da equipe com acesso vigente; permissões sensíveis continuam registradas na auditoria.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-8 gap-y-5 sm:grid-cols-4">
            {[
              ['Owners', stats.owner],
              ['Developers', stats.developer],
              ['Ativos', stats.active],
              ['Restritos', stats.suspended + stats.removed],
            ].map(([label, value]) => (
              <div key={label}>
                <strong className="block text-2xl font-bold tracking-[-0.03em] tabular-nums">{value}</strong>
                <span className="mt-1 block text-[11px] font-medium text-muted-foreground">{label}</span>
              </div>
            ))}
          </div>
        </section>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,744px)_330px]">
          <Card className="shadow-none">
            <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
              <h2 className="text-[17px] font-semibold">Diretório</h2>
              <span className="text-xs text-muted-foreground">{rows.length} membros</span>
            </CardHeader>
            <CardContent className="px-6 pb-4">
              <ul>
                {rows.map((member) => (
                  <li
                    key={member.user_id}
                    className="grid min-h-[82px] grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-4 border-b py-3 last:border-0"
                  >
                    <span className={cn(
                      'grid h-11 w-11 place-items-center rounded-full text-[11px] font-bold',
                      member.role === 'owner'
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-info-soft text-foreground',
                    )}>
                      {initials(member.display_name)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{member.display_name || 'Sem nome cadastrado'}</p>
                      <p className="mt-1 truncate text-[11px] text-muted-foreground">
                        Atualizado {formatRelative(member.updated_at)}
                      </p>
                    </div>
                    <div className="hidden items-center gap-2 sm:flex">
                      <StatusBadge value={member.role} />
                      <StatusBadge value={member.status} />
                    </div>
                    {can('staff.manage') && (
                      <Button variant="outline" size="sm" onClick={() => openPermissions(member)}>
                        Permissões
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Gerenciar ${member.display_name || member.user_id}`}
                      onClick={() => {
                        setDraft({ userId: member.user_id, role: member.role, status: member.status });
                        setConfirming(false);
                      }}
                    >
                      <MoreHorizontal />
                    </Button>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <div className="space-y-5">
            <aside className="rounded-2xl border border-border bg-muted/70 p-6">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary">Cobertura de papéis</p>
              <div className="mt-6 space-y-5">
                <CoverageBar label="Owners" value={stats.total ? stats.owner * 100 / stats.total : 0} tone="primary" />
                <CoverageBar label="Developers" value={stats.total ? stats.developer * 100 / stats.total : 0} tone="info" />
                <CoverageBar label="Acesso ativo" value={stats.total ? stats.active * 100 / stats.total : 0} tone="success" />
                <CoverageBar label="Acesso restrito" value={stats.total ? (stats.suspended + stats.removed) * 100 / stats.total : 0} tone="danger" />
              </div>
            </aside>

            <Card className="shadow-none">
              <CardHeader><h2 className="text-[17px] font-semibold">Estado de acesso</h2></CardHeader>
              <CardContent className="space-y-5 text-xs">
                <StateRow label="Ativos" value={stats.active} />
                <StateRow label="Suspensos" value={stats.suspended} tone="warning" />
                <StateRow label="Removidos" value={stats.removed} tone="danger" />
              </CardContent>
            </Card>
          </div>
        </div>
      </AsyncBoundary>

      <StaffDraftDialog
        draft={draft}
        open={Boolean(draft && !confirming)}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onContinue={() => setConfirming(true)}
      />
      {draft && (
        <HighRiskDialog
          open={confirming}
          title="Confirmar alteração de acesso"
          description="A alteração exige MFA e será registrada na auditoria com estado anterior e posterior, horário e justificativa."
          confirmLabel="Salvar membro"
          onClose={() => setConfirming(false)}
          onConfirm={async (reason) => {
            const result = await mutation.mutateAsync({ draft, reason });
            if (!result.ok) throw new Error(result.error);
            setConfirming(false);
            setDraft(null);
          }}
        />
      )}
      <StaffPermissionDialog
        draft={permissionDraft}
        open={Boolean(permissionDraft && !confirmingPermissions)}
        onChange={setPermissionDraft}
        onClose={() => setPermissionDraft(null)}
        onContinue={() => setConfirmingPermissions(true)}
      />
      {permissionDraft && (
        <HighRiskDialog
          open={confirmingPermissions}
          title="Confirmar alteração de permissões"
          description="As permissões efetivas serão recalculadas no servidor. A mudança exige MFA, justificativa e registro de auditoria."
          confirmLabel="Salvar permissões"
          onClose={() => setConfirmingPermissions(false)}
          onConfirm={async (reason) => {
            const result = await permissionMutation.mutateAsync({ draft: permissionDraft, reason });
            if (!result.ok) throw new Error(result.error);
            setConfirmingPermissions(false);
            setPermissionDraft(null);
          }}
        />
      )}
    </section>
  );
}

function StaffPermissionDialog({
  draft,
  open,
  onChange,
  onClose,
  onContinue,
}: {
  draft: PermissionDraft | null;
  open: boolean;
  onChange: (draft: PermissionDraft) => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  if (!draft) return null;
  const currentDraft = draft;
  function setEffect(permission: InternalPermission, value: string) {
    const overrides = { ...currentDraft.overrides };
    if (value === 'inherit') delete overrides[permission];
    else overrides[permission] = value as PermissionEffect;
    onChange({ ...currentDraft, overrides });
  }
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Permissões de {currentDraft.displayName || 'membro interno'}</DialogTitle>
          <DialogDescription>
            “Herdar” aplica o papel atual. “Conceder” adiciona uma exceção e “remover” bloqueia uma permissão que o papel concederia.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          {permissionGroups.map((group) => (
            <section key={group.label} className="space-y-3">
              <h3 className="text-sm font-semibold">{group.label}</h3>
              <div className="divide-y rounded-lg border">
                {group.permissions.map(([permission, label]) => (
                  <div key={permission} className="grid grid-cols-[minmax(0,1fr)_160px] items-center gap-4 p-3">
                    <div>
                      <p className="text-sm font-medium">{label}</p>
                      <p className="mt-0.5 font-mono text-[11px] text-muted-foreground">{permission}</p>
                    </div>
                    <Select value={currentDraft.overrides[permission] ?? 'inherit'} onValueChange={(value) => setEffect(permission, value)}>
                      <SelectTrigger aria-label={`Estado de ${label}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="inherit">Herdar papel</SelectItem>
                        <SelectItem value="grant">Conceder</SelectItem>
                        <SelectItem value="revoke">Remover</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={onContinue}><ShieldCheck />Revisar alteração</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StaffDraftDialog({
  draft,
  open,
  onChange,
  onClose,
  onContinue,
}: {
  draft: Draft | null;
  open: boolean;
  onChange: (draft: Draft) => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  if (!draft) return null;
  const valid = /^[0-9a-f-]{36}$/i.test(draft.userId);
  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Gerenciar membro</DialogTitle>
          <DialogDescription>
            Vincule um usuário autenticado a um papel interno e defina o estado de acesso.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="staff-user-id">User ID do Supabase Auth</Label>
            <Input
              id="staff-user-id"
              value={draft.userId}
              onChange={(event) => onChange({ ...draft, userId: event.target.value })}
              className="font-mono text-xs"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-role">Papel</Label>
            <select
              id="staff-role"
              value={draft.role}
              onChange={(event) => onChange({ ...draft, role: event.target.value })}
              className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
            >
              <option value="owner">Owner</option>
              <option value="developer">Developer</option>
              <option value="support">Suporte</option>
              <option value="auditor">Auditor</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="staff-status">Status</Label>
            <select
              id="staff-status"
              value={draft.status}
              onChange={(event) => onChange({ ...draft, status: event.target.value })}
              className="h-11 w-full rounded-lg border bg-background px-3 text-sm"
            >
              <option value="active">Ativo</option>
              <option value="suspended">Suspenso</option>
              <option value="removed">Removido</option>
            </select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button disabled={!valid} onClick={onContinue}>
            <ShieldCheck />
            Continuar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CoverageBar({ label, value, tone }: { label: string; value: number; tone: 'primary' | 'info' | 'success' | 'danger' }) {
  const tones = {
    primary: 'bg-primary',
    info: 'bg-info',
    success: 'bg-success',
    danger: 'bg-destructive',
  };
  const percent = Math.round(value);
  return (
    <div>
      <div className="flex justify-between text-[11px] font-semibold">
        <span>{label}</span>
        <span>{percent}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-background/15">
        <div className={cn('h-full rounded-full', tones[tone])} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function StateRow({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warning' | 'danger' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <strong className={cn(tone !== 'default' && 'text-foreground')}>{value}</strong>
    </div>
  );
}

function staffStats(rows: StaffRow[]) {
  return {
    total: rows.length,
    owner: rows.filter((row) => row.role === 'owner').length,
    developer: rows.filter((row) => row.role === 'developer').length,
    active: rows.filter((row) => row.status === 'active').length,
    suspended: rows.filter((row) => row.status === 'suspended').length,
    removed: rows.filter((row) => row.status === 'removed').length,
  };
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

function formatRelative(value: string) {
  return new Date(value).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}
