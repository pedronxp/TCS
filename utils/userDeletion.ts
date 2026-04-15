export type ManagedUserRole = 'master_admin' | 'admin' | 'supervisor' | 'agent';

export type UserDeletionGuardReason =
  | 'not_master_admin'
  | 'self_delete'
  | 'protected_role';

export interface UserDeletionGuardInput {
  currentUserId?: string | null;
  currentUserRole?: ManagedUserRole | null;
  targetUserId?: string | null;
  targetUserRole?: ManagedUserRole | null;
}

export interface UserDeletionImpact {
  vistorias: number;
  agendamentosCriados: number;
  agendamentosComoAgente: number;
  atribuicoesComoSupervisor: number;
  atribuicoesComoAgente: number;
}

export interface UserDeletionImpactItem {
  key: keyof UserDeletionImpact;
  label: string;
  count: number;
}

const IMPACT_LABELS: Record<keyof UserDeletionImpact, string> = {
  vistorias: 'Vistorias vinculadas',
  agendamentosCriados: 'Agendamentos criados',
  agendamentosComoAgente: 'Agendamentos atribuídos',
  atribuicoesComoSupervisor: 'Vínculos como supervisor',
  atribuicoesComoAgente: 'Vínculos como agente',
};

const IMPACT_ORDER: Array<keyof UserDeletionImpact> = [
  'vistorias',
  'agendamentosCriados',
  'agendamentosComoAgente',
  'atribuicoesComoSupervisor',
  'atribuicoesComoAgente',
];

export const EMPTY_USER_DELETION_IMPACT: UserDeletionImpact = {
  vistorias: 0,
  agendamentosCriados: 0,
  agendamentosComoAgente: 0,
  atribuicoesComoSupervisor: 0,
  atribuicoesComoAgente: 0,
};

export function getUserDeletionGuard({
  currentUserId,
  currentUserRole,
  targetUserId,
  targetUserRole,
}: UserDeletionGuardInput): { allowed: true } | { allowed: false; reason: UserDeletionGuardReason } {
  if (currentUserRole !== 'master_admin') {
    return { allowed: false, reason: 'not_master_admin' };
  }

  if (currentUserId && targetUserId && currentUserId === targetUserId) {
    return { allowed: false, reason: 'self_delete' };
  }

  if (targetUserRole === 'master_admin') {
    return { allowed: false, reason: 'protected_role' };
  }

  return { allowed: true };
}

export function getUserDeletionImpactItems(
  impact: UserDeletionImpact
): UserDeletionImpactItem[] {
  return IMPACT_ORDER
    .filter((key) => impact[key] > 0)
    .map((key) => ({
      key,
      label: IMPACT_LABELS[key],
      count: impact[key],
    }));
}

export function hasUserDeletionImpact(impact: UserDeletionImpact): boolean {
  return IMPACT_ORDER.some((key) => impact[key] > 0);
}
