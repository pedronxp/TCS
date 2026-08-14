// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { UsuariosPage } from './UsuariosPage';

const users = vi.hoisted(() => ([
  {
    uid: 'user-pending',
    name: 'Ana Vistoriadora',
    email: 'ana@cataguases.mg.gov.br',
    role: 'agent',
    isApproved: false,
    createdAt: '2026-07-30T12:00:00.000Z',
    municipio: 'Cataguases',
  },
  {
    uid: 'user-active',
    name: 'Bruno Fiscal',
    email: 'bruno@cataguases.mg.gov.br',
    role: 'supervisor',
    isApproved: true,
    createdAt: '2026-06-10T12:00:00.000Z',
    municipio: 'Cataguases',
  },
]));

const toggleMock = vi.hoisted(() => vi.fn());

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { role: 'master_admin', municipio: 'Cataguases' }, user: { id: 'staff-1' } }),
}));

vi.mock('@/hooks/useUsuarios', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/useUsuarios')>('@/hooks/useUsuarios');
  return {
    ...actual,
    useUsuarios: () => ({ data: users, isLoading: false, isError: false, refetch: vi.fn() }),
    useToggleAprovacao: () => ({
      mutate: toggleMock,
      isPending: false,
      variables: null,
    }),
    useResetSenha: () => ({ mutate: vi.fn(), isPending: false }),
  };
});

vi.mock('@/lib/supabase', () => ({ supabase: { from: vi.fn(() => ({})), rpc: vi.fn() } }));

afterEach(() => {
  cleanup();
  toggleMock.mockClear();
});

describe('Aprovação e acesso de usuários', () => {
  it('exibe o papel consolidado com o município', () => {
    render(<UsuariosPage />);

    expect(screen.getByText(/Agente · Cataguases/)).toBeVisible();
    expect(screen.getByText(/Supervisor · Cataguases/)).toBeVisible();
  });

  it('libera acesso de um usuário pendente com justificativa auditável', async () => {
    const user = userEvent.setup();
    render(<UsuariosPage />);

    // o botão de expandir é o chevron ao lado do status "Pendente"
    await user.click(screen.getByText('Pendente').parentElement!.querySelector('button')!);

    await user.click(screen.getByRole('button', { name: /^Liberar acesso$/ }));

    expect(screen.getByText('Liberar acesso deste agente?')).toBeVisible();

    // exige justificativa mínima de 8 caracteres — estado bloqueado
    const justificativa = screen.getByPlaceholderText(/Explique por que esta ação é necessária/i) as HTMLTextAreaElement;
    const confirm = screen.getAllByRole('button', { name: 'Liberar acesso' }).pop()!;
    expect(confirm).toBeDisabled();

    await user.type(justificativa, 'Identidade validada na sede.');
    expect(confirm).not.toBeDisabled();

    await user.click(confirm);

    expect(toggleMock).toHaveBeenCalledTimes(1);
    expect(toggleMock.mock.calls[0][0]).toEqual({ uid: 'user-pending', isApproved: true });
  });

  it('abre diálogo de bloqueio para usuário ativo sem remover o histórico', async () => {
    const user = userEvent.setup();
    render(<UsuariosPage />);

    await user.click(screen.getByText('Ativo').parentElement!.querySelector('button')!);

    await user.click(screen.getByRole('button', { name: /Bloquear acesso/i }));

    expect(screen.getByText('Bloquear acesso deste agente?')).toBeVisible();
    expect(screen.getByText(/sessões ativas serão encerradas/i)).toBeVisible();
  });
});
