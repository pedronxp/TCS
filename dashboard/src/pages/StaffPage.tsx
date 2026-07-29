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
import { useAdministrativeMutation } from '@/hooks/useAdministrativeMutation';
import { supabase } from '@/lib/supabase';
import { cn } from '@/lib/utils';

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

export function StaffPage() {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [confirming, setConfirming] = useState(false);
  const query = useQuery({
    queryKey: ['internal-staff'],
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

  const rows = useMemo(() => query.data ?? [], [query.data]);
  const stats = useMemo(() => staffStats(rows), [rows]);

  function openNewMember() {
    setDraft({ userId: '', role: 'developer', status: 'active' });
    setConfirming(false);
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
        <p className="text-[10px] font-bold uppercase tracking-wide text-info-strong">Organização interna</p>
        <h1 className="mt-2 text-[30px] font-bold leading-9 tracking-[-0.025em]">Equipe interna</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Papéis, capacidade e responsabilidade em uma visão humana da operação.
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
        <section className="grid min-h-[174px] gap-6 rounded-2xl border border-info-strong/20 bg-info-soft p-6 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <p className="text-[10px] font-bold uppercase text-info-strong">Time em destaque</p>
            <h2 className="mt-4 text-2xl font-bold">
              {stats.active} {stats.active === 1 ? 'pessoa conectada' : 'pessoas conectadas'} à operação
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Distribuição real entre papéis e estados de acesso configurados.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 sm:grid-cols-4">
            <StaffStatCircle label="Owner" value={stats.owner} tone="primary" />
            <StaffStatCircle label="Developer" value={stats.developer} tone="info" />
            <StaffStatCircle label="Ativos" value={stats.active} tone="success" />
            <StaffStatCircle label="Suspensos" value={stats.suspended} tone="warning" />
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
                    className="grid min-h-[82px] grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-4 border-b py-3 last:border-0"
                  >
                    <span className={cn(
                      'grid h-11 w-11 place-items-center rounded-full text-[11px] font-bold',
                      member.role === 'owner'
                        ? 'bg-warm text-warm-foreground'
                        : 'bg-info-soft text-info-strong',
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
            <aside className="rounded-[14px] bg-ink-panel p-6 text-white">
              <p className="text-[10px] font-bold uppercase text-warm">Cobertura de papéis</p>
              <div className="mt-7 space-y-6">
                <CoverageBar label="Owners" value={stats.total ? stats.owner * 100 / stats.total : 0} tone="warm" />
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
          description="A alteração exige MFA e será registrada com estado anterior e posterior."
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
    </section>
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

function StaffStatCircle({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'primary' | 'info' | 'success' | 'warning';
}) {
  const tones = {
    primary: 'bg-primary text-primary-foreground',
    info: 'bg-info-strong text-white',
    success: 'bg-success text-white',
    warning: 'bg-warning text-white',
  };
  return (
    <div className="text-center">
      <span className={cn('mx-auto grid h-[52px] w-[52px] place-items-center rounded-full text-sm font-bold', tones[tone])}>
        {value}
      </span>
      <span className="mt-3 block text-[10px] font-semibold">{label}</span>
    </div>
  );
}

function CoverageBar({ label, value, tone }: { label: string; value: number; tone: 'warm' | 'info' | 'success' | 'danger' }) {
  const tones = {
    warm: 'bg-warm',
    info: 'bg-info-strong',
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
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/15">
        <div className={cn('h-full rounded-full', tones[tone])} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}

function StateRow({ label, value, tone = 'default' }: { label: string; value: number; tone?: 'default' | 'warning' | 'danger' }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <strong className={cn(tone === 'warning' && 'text-warning', tone === 'danger' && 'text-destructive')}>{value}</strong>
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
