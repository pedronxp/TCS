jest.mock('../../utils/supabase', () => ({
  supabase: {
    from: jest.fn(),
    rpc: jest.fn(),
  },
}));

import { deleteUserAsMasterAdmin } from '../UserManagementService';

describe('deleteUserAsMasterAdmin', () => {
  const mockSupabase = jest.requireMock('../../utils/supabase').supabase as {
    rpc: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('envia a RPC com os parâmetros esperados', async () => {
    mockSupabase.rpc.mockResolvedValue({ error: null });

    await deleteUserAsMasterAdmin('user-123', true);

    expect(mockSupabase.rpc).toHaveBeenCalledWith('master_delete_user', {
      p_target_uid: 'user-123',
      p_delete_vistorias: true,
    });
  });

  it('traduz o erro quando a função RPC não existe no banco remoto', async () => {
    mockSupabase.rpc.mockResolvedValue({
      error: {
        message:
          'Error: Could not find the function public.master_delete_user(p_delete_vistorias, p_target_uid) in the schema cache',
      },
    });

    await expect(deleteUserAsMasterAdmin('user-123', false)).rejects.toThrow(
      'A função de exclusão de usuário não está disponível no Supabase. Aplique a migração 20260414_master_delete_user.sql no projeto remoto e tente novamente.'
    );
  });

  it('preserva outros erros da RPC', async () => {
    mockSupabase.rpc.mockResolvedValue({
      error: {
        message: 'Acesso negado: apenas master_admin pode excluir usuários.',
      },
    });

    await expect(deleteUserAsMasterAdmin('user-123', false)).rejects.toThrow(
      'Acesso negado: apenas master_admin pode excluir usuários.'
    );
  });

  it('traduz erro de função desatualizada quando agenteUid é TEXT no Supabase', async () => {
    mockSupabase.rpc.mockResolvedValue({
      error: {
        message: 'operator does not exist: text = uuid',
      },
    });

    await expect(deleteUserAsMasterAdmin('user-123', true)).rejects.toThrow(
      'A função de exclusão de usuário no Supabase está desatualizada para o campo vistorias.agenteUid. Reaplique a SQL corrigida de 20260414_master_delete_user.sql no projeto remoto e tente novamente.'
    );
  });
});
