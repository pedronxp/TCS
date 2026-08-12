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

    expect(screen.getByRole('heading', { level: 1, name: 'Catálogo de Planos' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Versionamento Comercial Auditável' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Municipal Básico' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Versões Publicadas' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Resumo de Recursos e Preços' })).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<PlansPage demo />);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('evidencia cobertura do catálogo e estados de versão sem inventar publicações', () => {
    render(<PlansPage demo />);
    // cobertura do catálogo agora mostra rascunhos em elaboração + planos registrados
    expect(screen.getByText(/rascunhos em elaboração/)).toBeVisible();
    // planos em rascunho não constam como publicados — estado honesto, sem mhprova fabricada
    expect(screen.getByText('Ainda não há edições publicadas.')).toBeVisible();
  });
});
