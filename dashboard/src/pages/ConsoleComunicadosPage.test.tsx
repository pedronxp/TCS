// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { ConsoleComunicadosPage } from './ConsoleComunicadosPage';
import { ConsoleComunicadoOrgPage } from './ConsoleComunicadoOrgPage';

const mocks = vi.hoisted(() => ({
  fetchOrgsComunicadosConsole: vi.fn(),
  fetchComunicadosOrgConsole: vi.fn(),
  fetchBotOnline: vi.fn(),
  salvarComunicadoConsole: vi.fn(),
  definirStatusComunicadoConsole: vi.fn(),
  dispararBotConsole: vi.fn(),
}));

vi.mock('@/lib/comunicados', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/comunicados')>()),
  fetchOrgsComunicadosConsole: mocks.fetchOrgsComunicadosConsole,
  fetchComunicadosOrgConsole: mocks.fetchComunicadosOrgConsole,
  fetchBotOnline: mocks.fetchBotOnline,
  salvarComunicadoConsole: mocks.salvarComunicadoConsole,
  definirStatusComunicadoConsole: mocks.definirStatusComunicadoConsole,
  dispararBotConsole: mocks.dispararBotConsole,
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
    { chatId: '1204@g.us', nome: 'Avisos do Centro', tipo: 'grupo', comunidadeId: 'community-1', comunidadeNome: 'Bairros de Cataguases', sessaoTelefone: '55****9001', totalAdmins: 2, totalParticipantes: 84, vistoEm: '2026-08-22T10:05:00Z' },
  ],
  canais: [
    { id: 'k-1', nome: 'Comunidade Cataguases', chatId: '1203@g.us', ativo: true, totalEnvios: 2 },
    { id: 'k-2', nome: 'Grupo Centro', chatId: '1204@g.us', ativo: true, totalEnvios: 0 },
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
    mocks.fetchBotOnline.mockReset().mockResolvedValue(true);
    mocks.salvarComunicadoConsole.mockReset().mockResolvedValue('com-new');
    mocks.definirStatusComunicadoConsole.mockReset().mockResolvedValue(undefined);
    mocks.dispararBotConsole.mockReset().mockResolvedValue(1);
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

  it('permite ocultar e exibir o histórico de entregas do WhatsApp', async () => {
    const user = userEvent.setup();
    renderPage('/app/whatsapp/org-1');

    const toggle = await screen.findByRole('button', { name: 'Ocultar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('Entregue')).toBeVisible();

    await user.click(toggle);

    expect(screen.getByRole('heading', { name: 'Entregas' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Exibir' })).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Entregue')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Exibir' }));

    expect(screen.getByText('Entregue')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-expanded', 'true');
  });

  it('protege nomes e grupos quando a organização não possui sessão online', async () => {
    mocks.fetchComunicadosOrgConsole.mockResolvedValue({
      ...orgDetalhe,
      runtime: { sessionsOnline: 0, serviceOnline: true, state: 'offline', sessions: [] },
      sessoes: [{ ...orgDetalhe.sessoes[0], status: 'desconectado', runtimeState: 'offline' }],
    });
    renderPage('/app/whatsapp/org-1');

    expect(await screen.findByText(/dados protegidos até um número reconectar/i)).toBeVisible();
    expect(screen.queryByText('Comunidade Cataguases')).not.toBeInTheDocument();
    expect(screen.queryByText('Avisos do Centro')).not.toBeInTheDocument();
  });

  it('rota de comunicados mantém o editor sem repetir a operação do WhatsApp', async () => {
    renderPage('/app/comunicacoes/org-1');
    expect(await screen.findByRole('heading', { name: 'Nova mensagem' })).toBeVisible();
    expect(screen.getByRole('checkbox', { name: /disparar pelo bot/i })).toBeChecked();
    expect(screen.queryByRole('heading', { name: 'Entregas' })).not.toBeInTheDocument();
  });

  it('publica um comunicado em vários grupos e comunidades selecionados', async () => {
    const user = userEvent.setup();
    renderPage('/app/comunicacoes/org-1');
    await screen.findByRole('heading', { name: 'Nova mensagem' });

    await user.type(screen.getByLabelText('Título'), 'Alerta de chuva forte');
    await user.type(screen.getByLabelText('Mensagem'), 'Procure um local seguro.');
    await user.click(screen.getByRole('checkbox', { name: /Comunidade Cataguases/i }));
    await user.click(screen.getByRole('checkbox', { name: /Grupo Centro/i }));
    expect(screen.getByText('2 destinos selecionados para o disparo.')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'Publicar agora' }));

    await waitFor(() => {
      expect(mocks.dispararBotConsole).toHaveBeenNthCalledWith(1, 'com-new', 'k-1');
      expect(mocks.dispararBotConsole).toHaveBeenNthCalledWith(2, 'com-new', 'k-2');
    });
    expect(await screen.findByRole('status')).toHaveTextContent('2 grupos ou comunidades na fila do WhatsApp');
  });

  it('insere emojis e contexto complementar na mensagem do console', async () => {
    const user = userEvent.setup();
    renderPage('/app/comunicacoes/org-1');
    await screen.findByRole('heading', { name: 'Nova mensagem' });

    await user.click(screen.getByRole('button', { name: 'Emojis' }));
    await user.click(screen.getByRole('button', { name: 'Inserir emoji Emergência' }));
    expect(screen.getByLabelText('Mensagem')).toHaveValue('🚨');

    await user.click(screen.getByRole('button', { name: 'Adicionar contexto' }));
    await user.click(screen.getByRole('button', { name: 'Local e horário' }));
    expect(screen.getByLabelText('Mensagem')).toHaveValue('🚨\n\n📍 Local: \n🕒 Horário: ');
  });

  it('mantém a estrutura acessível', async () => {
    const { container } = renderPage('/app/comunicacoes/org-1');
    await screen.findAllByText('Aviso de enchente');
    const resultado = await axe(container);
    expect(resultado.violations.map((violacao) => violacao.id)).toEqual([]);
  });
});
