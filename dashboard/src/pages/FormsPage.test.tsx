// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { axe } from 'vitest-axe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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
      { titulo: 'Identificação', perguntas: [{ texto: 'Informe o responsável técnico', tipo: 'cards', imagemLocal: 'https://example.com/reference.jpg', opcoes: [{ texto: 'Conforme', svgKey: 'licenciamento_conforme', pesoRisco: 0 }] }] },
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
  useAuth: () => ({ can: () => true, user: { id: 'staff-1' }, profile: { role: 'developer' } }),
}));

vi.mock('@/hooks/useAdministrativeMutation', () => ({
  useAdministrativeMutation: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

vi.mock('@/lib/supabase', () => ({ supabase: {} }));

afterEach(cleanup);

describe('Formulários versionados', () => {
  function renderForms(initialEntry = '/app/desenvolvimento/formularios') {
    return render(<MemoryRouter initialEntries={[initialEntry]}><Routes><Route path="/app/desenvolvimento/formularios" element={<FormsPage />} /><Route path="/app/desenvolvimento/formularios/:formId" element={<FormsPage />} /></Routes></MemoryRouter>);
  }

  it('reproduz métricas, catálogo, pré-visualização e histórico', () => {
    renderForms();

    expect(screen.getByRole('heading', { level: 1, name: 'Formulários' })).toBeVisible();
    expect(screen.getByText('Catálogo de formulários')).toBeVisible();
    expect(screen.getByRole('complementary', { name: 'Licenciamento urbano' })).toBeVisible();
    expect(screen.getByText('Estrutura reconhecida')).toBeVisible();
    expect(screen.getByText('Histórico da versão')).toBeVisible();
    expect(screen.getAllByText('Ativado').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/SVG/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/imagem/).length).toBeGreaterThan(0);
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    const { container } = renderForms();
    const result = await axe(container, { rules: { 'color-contrast': { enabled: false } } });
    expect(result.violations).toEqual([]);
  });

  it('mantém a prévia dentro do filtro e não promete editar um escopo imutável', () => {
    renderForms();

    fireEvent.change(screen.getByLabelText('Buscar formulários'), { target: { value: 'resultado inexistente' } });
    expect(screen.queryByRole('complementary', { name: 'Licenciamento urbano' })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Buscar formulários'), { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    expect(screen.getByLabelText('Município (vazio = global)')).toBeDisabled();
    expect(screen.getByText(/escopo municipal é imutável/)).toBeVisible();
  });

  it('abre a visualização na rota do formulário em um popup', () => {
    renderForms();
    fireEvent.click(screen.getByRole('button', { name: 'Visualizar Licenciamento urbano' }));
    expect(screen.getByRole('dialog')).toHaveTextContent('Visualização do formulário');
    expect(screen.getByText('Perguntas com recursos visuais')).toBeVisible();
    expect(screen.getByText(/SVG em cards/)).toBeVisible();
  });

  it('protege alterações não salvas antes de fechar o editor', () => {
    renderForms();
    fireEvent.click(screen.getByRole('button', { name: 'Editar' }));
    fireEvent.change(screen.getByLabelText('Título'), { target: { value: 'Licenciamento urbano revisado' } });
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('dialog', { name: 'Descartar alterações não salvas?' })).toBeVisible();
    expect(screen.getByText(/Atualizar, fechar ou trocar de rota/)).toBeVisible();
  });
});
