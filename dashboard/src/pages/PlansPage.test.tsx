// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlansPage } from './PlansPage';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('@/hooks/usePlanMutation', () => ({
  usePlanMutation: () => ({ mutateAsync: vi.fn() }),
}));

afterEach(cleanup);

describe('Catálogo de planos', () => {
  it('reproduz catálogo, versionamento e comparativo comercial', () => {
    render(<PlansPage demo />);

    expect(screen.getByRole('heading', { level: 1, name: 'Planos' })).toBeVisible();
    expect(screen.getByText('Versionamento comercial ativo')).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Municipal Básico' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Versões recentes' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Comparativo comercial' })).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<PlansPage demo />);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
