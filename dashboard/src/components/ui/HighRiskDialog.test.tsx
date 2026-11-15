// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighRiskDialog } from './HighRiskDialog';

const mocks = vi.hoisted(() => ({
  listFactors: vi.fn().mockResolvedValue({ data: { totp: [] }, error: null }),
  refreshAssurance: vi.fn(),
  assurance: 'aal2',
  verify: vi.fn(),
  enroll: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { assuranceLevel: mocks.assurance }, refreshAssurance: mocks.refreshAssurance }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { mfa: {
      listFactors: mocks.listFactors,
      challengeAndVerify: mocks.verify,
      enroll: mocks.enroll,
    } },
  },
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); mocks.assurance = 'aal2'; mocks.listFactors.mockResolvedValue({ data: { totp: [] }, error: null }); });

describe('HighRiskDialog', () => {
  it('mantém confirmação auditável em diálogo acessível e restaura o fechamento', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<HighRiskDialog open title="Confirmar bloqueio" description="Ação administrativa" confirmLabel="Bloquear" onClose={onClose} onConfirm={onConfirm} />);

    expect(screen.getByRole('dialog', { name: 'Confirmar bloqueio' })).toBeVisible();
    await waitFor(() => expect(screen.getByLabelText('Justificativa')).toHaveFocus());
    await user.type(screen.getByLabelText('Justificativa'), 'Incidente confirmado pela coordenação');
    await user.click(screen.getByRole('button', { name: 'Bloquear' }));

    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('Incidente confirmado pela coordenação'));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it('não reduz a exigência mínima de justificativa', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(<HighRiskDialog open title="Confirmar" description="Ação de risco" confirmLabel="Aplicar" onClose={vi.fn()} onConfirm={onConfirm} />);

    await waitFor(() => expect(screen.getByLabelText('Justificativa')).toHaveFocus());
    await user.type(screen.getByLabelText('Justificativa'), 'curta');
    await user.click(screen.getByRole('button', { name: 'Aplicar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('pelo menos 8 caracteres');
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

it('explica instalação e configuração para quem não possui autenticador', async () => {
  mocks.assurance = 'aal1';
  render(<HighRiskDialog open title="Token" description="Criar convite" confirmLabel="Gerar" onClose={vi.fn()} onConfirm={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Preciso configurar' }));
  expect(await screen.findByText(/loja de aplicativos/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Configurar autenticador' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: /^Gerar$/ })).not.toBeInTheDocument();
});
it('trata código incorreto e permite tentar novamente sem executar a ação', async () => {
  mocks.assurance = 'aal1';
  mocks.listFactors.mockResolvedValue({ data: { totp: [{ id: 'factor', status: 'verified' }] }, error: null });
  mocks.verify.mockResolvedValue({ error: { message: 'invalid' } });
  const confirm = vi.fn();
  render(<HighRiskDialog open title="Token" description="Criar convite" confirmLabel="Gerar" onClose={vi.fn()} onConfirm={confirm} />);
  await userEvent.click(screen.getByRole('button', { name: 'Já tenho o código' }));
  await userEvent.type(await screen.findByLabelText('Código do autenticador'), '123456');
  await userEvent.click(screen.getByRole('button', { name: 'Verificar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Código inválido ou vencido');
  expect(screen.getByRole('button', { name: 'Verificar' })).toBeEnabled();
  expect(confirm).not.toHaveBeenCalled();
});
it('trata falha de rede ao consultar os fatores e permite repetir', async () => {
  mocks.assurance = 'aal1'; mocks.listFactors.mockRejectedValue(new Error('network'));
  render(<HighRiskDialog open title="Token" description="Criar convite" confirmLabel="Gerar" onClose={vi.fn()} onConfirm={vi.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível consultar');
  expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeEnabled();
});
