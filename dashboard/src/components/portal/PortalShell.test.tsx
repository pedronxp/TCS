// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PortalShell } from './PortalShell';
import type { PortalAccessContext } from '@/types/portal';

const authState = vi.hoisted(() => ({
  access: null as PortalAccessContext | null,
  signOut: vi.fn(),
}));

vi.mock('@/contexts/PortalAuthContext', () => ({ usePortalAuth: () => authState }));

function municipalAccess(overrides: Partial<PortalAccessContext> = {}): PortalAccessContext {
  return {
    accountKind: 'organization',
    userId: 'user-1',
    displayName: 'Maria Silva',
    organizationId: 'org-1',
    organizationName: 'Município Piloto',
    role: 'agent',
    membershipStatus: 'active',
    subscriptionStatus: 'active',
    cancelAtPeriodEnd: false,
    planId: 'plan-1',
    planVersionId: 'version-1',
    planName: 'Municipal',
    features: {},
    limits: {},
    usage: {},
    permissions: ['dashboard.read', 'inspection.read', 'appointment.read', 'support.read', 'profile.read'],
    creationAllowed: true,
    restrictionCause: null,
    ...overrides,
  };
}

function renderShell() {
  return render(
    <MemoryRouter initialEntries={['/portal/municipal']}>
      <Routes>
        <Route path="/portal/municipal" element={<PortalShell />}>
          <Route index element={<h1>Conteúdo municipal</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  authState.access = null;
  authState.signOut.mockReset();
  document.body.style.overflow = '';
  delete document.documentElement.dataset.theme;
});

describe('fundação do portal', () => {
  it('expõe público, função e navegação agrupada sem módulos não autorizados', () => {
    authState.access = municipalAccess();
    renderShell();

    expect(screen.getAllByText('Portal municipal').length).toBeGreaterThan(0);
    expect(screen.getByText('Agente municipal', { exact: true })).toBeVisible();
    expect(screen.getByText('Operação')).toBeVisible();
    expect(screen.getByText('Conta e suporte')).toBeVisible();
    expect(screen.getByText('Assinatura ativa')).toHaveClass('text-foreground');
    expect(screen.getByRole('link', { name: 'Visão geral' })).toHaveClass('text-foreground');
    expect(screen.getByRole('link', { name: 'Início' })).toHaveClass('text-foreground');
    expect(screen.queryByRole('link', { name: 'Equipe' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Conteúdo municipal' })).toBeVisible();
  });

  it('mostra a tag Papel · Município no cabeçalho e na sidebar', () => {
    authState.access = municipalAccess({ role: 'master' });
    renderShell();

    const tags = screen.getAllByText('Master municipal · Município Piloto');
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0]).toBeVisible();
  });

  it('expõe link para assinatura na faixa de bloqueio quando a criação está indisponível', () => {
    authState.access = municipalAccess({
      role: 'master',
      creationAllowed: false,
      restrictionCause: 'subscription_past_due',
      permissions: ['dashboard.read', 'inspection.read', 'billing.read'],
    });
    renderShell();

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Ver assinatura em /portal/municipal/assinatura');
  });

  it('mantém a marca TCS como identidade não navegável', () => {
    authState.access = municipalAccess();
    renderShell();

    expect(screen.queryByRole('link', { name: /TCS\s*Portal municipal/i })).not.toBeInTheDocument();
  });

  it('mantém o foco preso na navegação móvel e restaura o acionador', async () => {
    const user = userEvent.setup();
    authState.access = municipalAccess();
    renderShell();

    const trigger = screen.getByRole('button', { name: 'Abrir menu' });
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    await user.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Navegação do portal' });
    const close = screen.getByRole('button', { name: 'Fechar menu' });
    const signOut = screen.getAllByRole('button', { name: 'Sair' }).find((button) => dialog.contains(button));

    expect(dialog).toBeVisible();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(close).toHaveFocus();
    expect(trigger.closest('[aria-hidden="true"]')).not.toBeNull();

    await user.tab({ shift: true });
    expect(signOut).toHaveFocus();
    await user.tab();
    expect(close).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Navegação do portal' })).not.toBeInTheDocument();
    expect(trigger).toHaveFocus();
    expect(trigger.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('mantém o acesso visível e anuncia quando o logout falha', async () => {
    const user = userEvent.setup();
    authState.access = municipalAccess();
    authState.signOut.mockRejectedValueOnce(new Error('network'));
    renderShell();

    await user.click(screen.getAllByRole('button', { name: 'Sair' })[0]);

    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((alert) => alert.textContent?.includes('sessão continua aberta'))).toBe(true);
    expect(screen.getByRole('heading', { name: 'Conteúdo municipal' })).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Sair' })[0]).toBeEnabled();
  });

  it.each(['light', 'dark'] as const)('explica honestamente o bloqueio com foreground contrastante no tema %s', async (theme) => {
    authState.access = municipalAccess({ creationAllowed: false, restrictionCause: 'subscription_past_due' });
    const { container } = renderShell();
    document.documentElement.dataset.theme = theme;

    const notice = screen.getByRole('status');
    expect(notice).toHaveTextContent('Ações de criação indisponíveis.');
    expect(notice).not.toHaveTextContent(/erro inesperado/i);
    expect(notice).toHaveClass('bg-warning-soft', 'text-foreground');
    expect(notice).not.toHaveClass('text-warning');
    expect((await axe(container)).violations).toEqual([]);
  });
});
