// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ConsoleComunicadosPage } from './ConsoleComunicadosPage';
import { ConsoleComunicadoOrgPage } from './ConsoleComunicadoOrgPage';

const mocks = vi.hoisted(() => ({
  fetchOrgsComunicadosConsole: vi.fn(),
  fetchComunicadosOrgConsole: vi.fn(),
}));

vi.mock('@/lib/comunicados', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/comunicados')>()),
  fetchOrgsComunicadosConsole: mocks.fetchOrgsComunicadosConsole,
  fetchComunicadosOrgConsole: mocks.fetchComunicadosOrgConsole,
}));

const orgResumo = {
  organizationId: 'org-1',
  organizationName: 'Prefeitura de Cataguases',
  municipality: 'Cataguases',
  comunicadosPublicados: 1,
  comunidadesAtivas: 1,
  numerosVinculados: 1,
  enviosPendentes: 0,
  enviosFalhas: 1,
};

const orgDetalhe = {
  organization: { id: 'org-1', name: 'Prefeitura de Cataguases', municipality: 'Cataguases' },
  sessoes: [
    { id: 's-1', telefone: '55****9001', status: 'vinculado', vinculadoPorNome: 'Owner', vinculadoEm: '2026-08-22T10:00:00Z', totalChats: 4 },
  ],
  chats: [
    { chatId: '1203@g.us', nome: 'Anúncios · Cataguases', tipo: 'grupo', sessaoTelefone: '55****9001', totalAdmins: 2, totalParticipantes: 157, vistoEm: '2026-08-22T10:05:00Z' },
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
        { canalId: 'k-1', canalNome: 'Comunidade Cataguases', status: 'enviado', origem: 'bot', erro: null, enviadoEm: '2026-08-22T09:01:00Z', registradoPorNome: null, sessaoTelefone: '55****9001', tentativas: [{ telefone: '55****9002', erro: 'sessão não está conectada agora' }] },
      ],
    },
  ],
};

function renderPage(entry: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/app/comunicacoes" element={<ConsoleComunicadosPage />} />
          <Route path="/app/comunicacoes/:orgId" element={<ConsoleComunicadoOrgPage />} />
          <Route path="/app/whatsapp/:orgId" element={<ConsoleComunicadoOrgPage mode="whatsapp" backTo="/app/whatsapp" backLabel="WhatsApp Bot" />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('comunicados no console interno', () => {
  beforeEach(() => {
    mocks.fetchOrgsComunicadosConsole.mockReset().mockResolvedValue([orgResumo]);
    mocks.fetchComunicadosOrgConsole.mockReset().mockResolvedValue(orgDetalhe);
  });
  afterEach(cleanup);

  it('lista prefeituras e o clique abre o espaço da prefeitura', async () => {
    renderPage('/app/comunicacoes');
    expect(await screen.findByRole('heading', { name: 'Comunicados e comunidades' })).toBeVisible();
    const botao = await screen.findByRole('button', { name: 'Abrir operação de Prefeitura de Cataguases' });
    expect(botao).toBeVisible();
    botao.click();
    // A navegação leva ao espaço da prefeitura com o título dela em destaque.
    expect(await screen.findByRole('heading', { name: 'Prefeitura de Cataguases', level: 1 })).toBeVisible();
  });

  it('rota do WhatsApp mostra entregas, número mascarado que enviou e fallback', async () => {
    renderPage('/app/whatsapp/org-1');
    expect(await screen.findByRole('heading', { name: 'Entregas' })).toBeVisible();
    expect(await screen.findByText('Entregue')).toBeVisible();
    expect(screen.getByText(/pelo número 55\*\*\*\*9001/)).toBeInTheDocument();
    expect(screen.getByText(/55\*\*\*\*9002 \(sessão não está conectada agora\)/)).toBeInTheDocument();
    expect(screen.getByText('55****9001')).toBeInTheDocument();
  });

  it('rota de comunicados mantém o editor sem repetir a operação do WhatsApp', async () => {
    renderPage('/app/comunicacoes/org-1');
    expect(await screen.findByRole('heading', { name: 'Nova mensagem' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /disparar pelo bot/i })).toBeChecked();
    expect(screen.queryByRole('heading', { name: 'Entregas' })).not.toBeInTheDocument();
  });

  it('mantém a estrutura acessível', async () => {
    const { container } = renderPage('/app/comunicacoes/org-1');
    await screen.findAllByText('Aviso de enchente');
    const resultado = await axe(container);
    expect(resultado.violations.map((violacao) => violacao.id)).toEqual([]);
  });
});
