import {
  getUserDeletionGuard,
  getUserDeletionImpactItems,
  hasUserDeletionImpact,
} from '../userDeletion';

describe('getUserDeletionGuard', () => {
  it('permite que master_admin exclua admin', () => {
    expect(
      getUserDeletionGuard({
        currentUserId: 'master-1',
        currentUserRole: 'master_admin',
        targetUserId: 'admin-1',
        targetUserRole: 'admin',
      })
    ).toEqual({ allowed: true });
  });

  it('bloqueia exclusão quando o usuário atual não é master_admin', () => {
    expect(
      getUserDeletionGuard({
        currentUserId: 'admin-1',
        currentUserRole: 'admin',
        targetUserId: 'agent-1',
        targetUserRole: 'agent',
      })
    ).toEqual({ allowed: false, reason: 'not_master_admin' });
  });

  it('bloqueia autoexclusão', () => {
    expect(
      getUserDeletionGuard({
        currentUserId: 'master-1',
        currentUserRole: 'master_admin',
        targetUserId: 'master-1',
        targetUserRole: 'master_admin',
      })
    ).toEqual({ allowed: false, reason: 'self_delete' });
  });

  it('bloqueia exclusão de outro master_admin', () => {
    expect(
      getUserDeletionGuard({
        currentUserId: 'master-1',
        currentUserRole: 'master_admin',
        targetUserId: 'master-2',
        targetUserRole: 'master_admin',
      })
    ).toEqual({ allowed: false, reason: 'protected_role' });
  });
});

describe('impacto de exclusão de usuário', () => {
  it('retorna apenas itens com impacto real, em ordem estável', () => {
    expect(
      getUserDeletionImpactItems({
        vistorias: 3,
        agendamentosCriados: 0,
        agendamentosComoAgente: 2,
        atribuicoesComoSupervisor: 1,
        atribuicoesComoAgente: 0,
      })
    ).toEqual([
      { key: 'vistorias', label: 'Vistorias vinculadas', count: 3 },
      { key: 'agendamentosComoAgente', label: 'Agendamentos atribuídos', count: 2 },
      { key: 'atribuicoesComoSupervisor', label: 'Vínculos como supervisor', count: 1 },
    ]);
  });

  it('detecta quando não há impacto relacionado', () => {
    expect(
      hasUserDeletionImpact({
        vistorias: 0,
        agendamentosCriados: 0,
        agendamentosComoAgente: 0,
        atribuicoesComoSupervisor: 0,
        atribuicoesComoAgente: 0,
      })
    ).toBe(false);
  });
});
