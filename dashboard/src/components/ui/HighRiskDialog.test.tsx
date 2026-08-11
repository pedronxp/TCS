// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { HighRiskDialog } from './HighRiskDialog';

const mocks = vi.hoisted(() => ({
  listFactors: vi.fn().mockResolvedValue({ data: { totp: [] }, error: null }),
  refreshAssurance: vi.fn(),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ profile: { assuranceLevel: 'aal2' }, refreshAssurance: mocks.refreshAssurance }),
}));

vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { mfa: {
      listFactors: mocks.listFactors,
      challengeAndVerify: vi.fn(),
      enroll: vi.fn(),
    } },
  },
}));

afterEach(() => { cleanup(); vi.clearAllMocks(); });

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
