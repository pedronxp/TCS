// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CommandPalette } from './CommandPalette';
import type { Theme } from '@/hooks/useTheme';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// jsdom não implementa scrollIntoView (usado pelo cmdk no item selecionado).
Element.prototype.scrollIntoView = () => {};

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    profile: {
      role: 'owner',
      permissions: ['dashboard.executive.read', 'customer.read', 'support.read'],
    },
  }),
}));

function renderPalette({
  onOpenChange = vi.fn(),
  onThemeChange = vi.fn(),
  theme = 'light' as Theme,
}: {
  onOpenChange?: (open: boolean) => void;
  onThemeChange?: (theme: Theme) => void;
  theme?: Theme;
} = {}) {
  return render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/app" element={<div>Console</div>} />
        <Route path="/app/clientes" element={<div>Clientes</div>} />
      </Routes>
      <CommandPalette open onOpenChange={onOpenChange} theme={theme} onThemeChange={onThemeChange} />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
});

describe('CommandPalette', () => {
  it('lista apenas páginas liberadas para o perfil', async () => {
    renderPalette();

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(await screen.findByText('Visão executiva')).toBeInTheDocument();
    expect(screen.getByText('Clientes')).toBeInTheDocument();
    expect(screen.queryByText('Assinaturas')).not.toBeInTheDocument();
    expect(screen.queryByText('Auditoria')).not.toBeInTheDocument();
  });

  it('navega para a página selecionada e fecha a paleta', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    renderPalette({ onOpenChange });

    const input = screen.getByPlaceholderText(/Buscar páginas e ações/);
    await user.type(input, 'clientes');
    const item = await screen.findAllByText('Clientes');
    await user.click(item[0]);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it('oferece alternância de tema com rótulo do próximo tema', async () => {
    const onThemeChange = vi.fn();
    const onOpenChange = vi.fn();
    renderPalette({ theme: 'light', onThemeChange, onOpenChange });

    const botaoTema = screen.getByRole('option', { name: /Alternar para tema escuro/i });
    await userEvent.setup().click(botaoTema);

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
    expect(onThemeChange).toHaveBeenCalledWith('dark');
  });
});
