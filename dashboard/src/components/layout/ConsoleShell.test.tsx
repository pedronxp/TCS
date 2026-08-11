// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConsoleShell } from './ConsoleShell';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

vi.mock('./AppHeader', () => ({
  AppHeader: ({ onOpenMobile, density, onDensityChange }: {
    onOpenMobile: () => void;
    density: 'comfortable' | 'compact';
    onDensityChange: (density: 'comfortable' | 'compact') => void;
  }) => (
    <header>
      <span>Densidade: {density}</span>
      <button type="button" onClick={onOpenMobile}>Abrir navegação</button>
      <button type="button" onClick={() => onDensityChange('compact')}>Usar densidade compacta</button>
    </header>
  ),
}));

vi.mock('./AppSidebar', () => ({
  AppSidebar: ({ mobile }: { mobile?: boolean }) => <nav aria-label={mobile ? 'Navegação móvel simulada' : 'Navegação desktop simulada'} />,
}));

function renderShell(path = '/app') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/app" element={<ConsoleShell />}>
          <Route index element={<h1>Painel interno</h1>} />
          <Route path="clientes" element={<h1>Clientes internos</h1>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.body.style.overflow = '';
});

describe('estrutura do novo console', () => {
  it('oferece salto de teclado e região principal focável', () => {
    renderShell();

    expect(screen.getByRole('link', { name: 'Pular para o conteúdo' })).toHaveAttribute('href', '#console-content');
    expect(screen.getByRole('main', { name: 'Conteúdo do console' })).toHaveAttribute('id', 'console-content');
    expect(screen.getByRole('heading', { name: 'Painel interno' })).toBeVisible();
    expect(document.title).toBe('Visão geral — TCS Console');
  });

  it('preserva preferência de densidade e abre a navegação móvel como sheet', async () => {
    const user = userEvent.setup();
    renderShell('/app/clientes');

    await user.click(screen.getByRole('button', { name: 'Usar densidade compacta' }));
    expect(screen.getByText('Densidade: compact')).toBeVisible();
    await waitFor(() => expect(localStorage.getItem('tcs.console.density')).toBe('compact'));

    await user.click(screen.getByRole('button', { name: 'Abrir navegação' }));
    expect(screen.getByRole('dialog', { name: 'Navegação do console' })).toBeVisible();
    expect(screen.getByRole('navigation', { name: 'Navegação móvel simulada' })).toBeVisible();
  });
});
