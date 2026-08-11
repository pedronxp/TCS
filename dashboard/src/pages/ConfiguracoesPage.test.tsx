// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it } from 'vitest';
import { ConfiguracoesPage } from './ConfiguracoesPage';

afterEach(cleanup);

describe('Configurações', () => {
  it('expõe integrações sem inventar um contrato de mutação', () => {
    render(<MemoryRouter><ConfiguracoesPage /></MemoryRouter>);
    expect(screen.getByRole('heading', { level: 1, name: 'Configurações' })).toBeVisible();
    expect(screen.getByText('Configuração informativa nesta onda')).toBeVisible();
    expect(screen.getByText('Google Drive')).toBeVisible();
    expect(screen.getByText('Nenhum conjunto genérico publicável')).toBeVisible();
    expect(screen.getByText('Status não exposto ao cliente')).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<MemoryRouter><ConfiguracoesPage /></MemoryRouter>);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
