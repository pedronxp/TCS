// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ConsoleComunicadosPage } from './ConsoleComunicadosPage';

const mocks = vi.hoisted(() => ({
  fetchOrgsComunicadosConsole: vi.fn(),
  fetchComunicadosOrgConsole: vi.fn(),
}));

vi.mock('@/lib/comunicados', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/comunicados')>()),
  fetchOrgsComunicadosConsole: mocks.fetchOrgsComunicadosConsole,
  fetchComunicadosOrgConsole: mocks.fetchComunicadosOrgConsole,
}));

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <ConsoleComunicadosPage />
    </QueryClientProvider>,
  );
}

describe('comunicados no console interno', () => {
  beforeEach(() => {
    mocks.fetchOrgsComunicadosConsole.mockReset().mockResolvedValue([
      {
        organizationId: 'org-1',
        organizationName: 'Prefeitura de Cataguases',
        municipality: 'Cataguases',
        comunicadosPublicados: 2,
        comunidadesAtivas: 1,
        numerosVinculados: 1,
        enviosPendentes: 0,
        enviosFalhas: 1,
      },
    ]);
    mocks.fetchComunicadosOrgConsole.mockReset().mockResolvedValue({
      organization: { id: 'org-1', name: 'Prefeitura de Cataguases', municipality: 'Cataguases' },
      sessoes: [
        { id: 's-1', telefone: '32999990001', status: 'vinculado', vinculadoPorNome: 'Owner', vinculadoEm: '2026-08-22T10:00:00Z', totalChats: 4 },
      ],
      chats: [
        { chatId: '1203@g.us', nome: 'Anúncios · Cataguases', tipo: 'grupo', sessaoTelefone: '32999990001', vistoEm: '2026-08-22T10:05:00Z' },
      ],
      canais: [
        { id: 'k-1', nome: 'Comunidade Cataguases', chatId: '1203@g.us', ativo: true, totalEnvios: 2 },
      ],
      comunicados: [
        {
          id: 'com-1',
          titulo: 'Aviso de enchente',
          severidade: 'emergencia',
          status: 'publicado',
          publicadoEm: '2026-08-22T09:00:00Z',
          publicarEm: null,
          expiraEm: null,
          criadoEm: '2026-08-22T08:00:00Z',
          envios: [
            { canalId: 'k-1', canalNome: 'Comunidade Cataguases', status: 'enviado', origem: 'bot', erro: null, enviadoEm: '2026-08-22T09:01:00Z', registradoPorNome: null, sessaoTelefone: '32999990001', tentativas: [{ telefone: '32999990002', erro: 'sessão não está conectada agora' }] },
          ],
        },
      ],
    });
  });
  afterEach(cleanup);

  it('lista prefeituras com resumo e o detalhe da selecionada', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Comunicados e comunidades' })).toBeVisible();
    expect(await screen.findByText('Prefeitura de Cataguases')).toBeInTheDocument();
    expect((await screen.findAllByText('Aviso de enchente')).length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: /disparar pelo bot/i })).toBeEnabled();
    expect(screen.getByText('32999990001')).toBeInTheDocument();
  });

  it('mostra entregas com status, número que enviou e trilha de fallback', async () => {
    renderPage();
    expect(await screen.findByText('Entregas · Prefeitura de Cataguases')).toBeVisible();
    expect(await screen.findByText('Entregue')).toBeVisible();
    expect(screen.getByText(/pelo número 32999990001/)).toBeInTheDocument();
    expect(screen.getByText(/32999990002 \(sessão não está conectada agora\)/)).toBeInTheDocument();
  });

  it('mantém a estrutura acessível', async () => {
    const { container } = renderPage();
    await screen.findAllByText('Aviso de enchente');
    expect((await axe(container)).violations).toEqual([]);
  });
});
