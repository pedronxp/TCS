// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FormsPage } from './FormsPage';

const forms = vi.hoisted(() => ([
  {
    id: 'form-1',
    title: 'Licenciamento urbano',
    description: 'Fluxo municipal de licenciamento',
    status: 'publicado',
    active: true,
    municipality: null,
    version: 8,
    questions: [{ texto: 'Qual é o endereço da obra?' }],
    classification: { R1: { min: 0, max: 24 } },
    phases: [
      { titulo: 'Identificação', perguntas: [{ texto: 'Informe o responsável técnico' }] },
      { titulo: 'Documentos', perguntas: [] },
    ],
    calculationType: 'soma_total',
    updatedAt: '2026-07-26T12:00:00.000Z',
    versions: [
      { version: 8, status: 'publicado', reason: 'Publicação aprovada', createdAt: '2026-07-26T12:00:00.000Z' },
      { version: 7, status: 'rascunho', reason: 'Revisão', createdAt: '2026-07-25T12:00:00.000Z' },
    ],
  },
  {
    id: 'form-2',
    title: 'Vistoria sanitária',
    description: 'Checklist sanitário',
    status: 'rascunho',
    active: false,
    municipality: 'Campinas',
    version: 3,
    questions: [],
    classification: {},
    phases: [],
    calculationType: 'ponderada_max_elemento',
    updatedAt: '2026-07-25T12:00:00.000Z',
    versions: [{ version: 3, status: 'rascunho', reason: 'Revisão', createdAt: '2026-07-25T12:00:00.000Z' }],
  },
]));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({
    data: forms,
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
}));

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ can: () => true }),
}));

vi.mock('@/hooks/useAdministrativeMutation', () => ({
  useAdministrativeMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

afterEach(cleanup);

describe('Formulários versionados', () => {
  it('reproduz métricas, catálogo, pré-visualização e histórico', () => {
    render(<FormsPage />);

    expect(screen.getByRole('heading', { level: 1, name: 'Formulários' })).toBeVisible();
    expect(screen.getByText('Catálogo de formulários')).toBeVisible();
    expect(screen.getByRole('complementary', { name: 'Licenciamento urbano' })).toBeVisible();
    expect(screen.getByText('Estrutura reconhecida')).toBeVisible();
    expect(screen.getByText('Histórico da versão')).toBeVisible();
    expect(screen.getAllByText('Publicado').length).toBeGreaterThan(0);
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = render(<FormsPage />);
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });
});
