// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { axe } from 'vitest-axe';
import { PortalComunicadosPage } from './PortalComunicadosPage';
import type { Comunicado } from '@/lib/comunicados';

const mocks = vi.hoisted(() => ({
  fetchComunicados: vi.fn(),
  fetchBairros: vi.fn(),
  fetchCanais: vi.fn(),
  fetchBotChats: vi.fn(),
  fetchSessoesBot: vi.fn(),
  saveComunicado: vi.fn(),
  setComunicadoStatus: vi.fn(),
  dispararBot: vi.fn(),
  can: vi.fn(),
}));

vi.mock('@/lib/comunicados', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/comunicados')>()),
  fetchComunicados: mocks.fetchComunicados,
  fetchBairros: mocks.fetchBairros,
  fetchCanais: mocks.fetchCanais,
  fetchBotChats: mocks.fetchBotChats,
  fetchSessoesBot: mocks.fetchSessoesBot,
  saveComunicado: mocks.saveComunicado,
  setComunicadoStatus: mocks.setComunicadoStatus,
  dispararBot: mocks.dispararBot,
}));
vi.mock('@/contexts/PortalAuthContext', () => ({
  usePortalAuth: () => ({
    access: { accountKind: 'organization' as const, userId: 'user-1', organizationId: 'org-1', organizationName: 'Prefeitura de Aurora', role: 'admin' as const },
    can: mocks.can,
  }),
}));

const comunicadoPublicado: Comunicado = {
  id: 'com-1',
  titulo: 'Limpeza de canal programada',
  conteudo: 'Equipe de zelo urbano atua no bairro Centro na quarta-feira.',
  severidade: 'alerta',
  status: 'publicado',
  autorNome: 'Coordenação',
  publicadoEm: '2026-08-21T12:00:00Z',
  publicarEm: null,
  expiraEm: null,
  criadoEm: '2026-08-20T10:00:00Z',
  destinos: [{ bairroId: 'b-1', bairroNome: 'Centro', todoMunicipio: false }],
  totalLeituras: 4,
  lido: false,
  podeEditar: true,
  envios: [{ canalId: 'k-1', canalNome: 'Comunidade Aurora', status: 'enviado', origem: 'bot', erro: null, enviadoEm: '2026-08-21T12:05:00Z', registradoPorNome: null, sessaoTelefone: '32999990001', tentativas: [] }],
};

const comunicadoAgendado: Comunicado = {
  ...comunicadoPublicado,
  id: 'com-2',
  titulo: 'Mutirão de limpeza',
  status: 'agendado',
  publicadoEm: null,
  publicarEm: '2026-08-25T10:00:00Z',
  destinos: [{ bairroId: null, bairroNome: null, todoMunicipio: true }],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <PortalComunicadosPage />
    </QueryClientProvider>,
  );
}

describe('comunicados municipais do portal', () => {
  beforeEach(() => {
    mocks.fetchComunicados.mockReset().mockResolvedValue([comunicadoPublicado, comunicadoAgendado]);
    mocks.fetchBairros.mockReset().mockResolvedValue([
      { id: 'b-1', nome: 'Centro', ativo: true, emUso: true, podeGerenciar: true },
    ]);
    mocks.fetchCanais.mockReset().mockResolvedValue([
      { id: 'k-1', nome: 'Comunidade Aurora', tipo: 'whatsapp_comunidade', chatId: '1203@g.us', linkConvite: null, telefoneAdmin: null, ativo: true, totalEnvios: 2, podeGerenciar: true },
      { id: 'k-2', nome: 'Grupo Centro', tipo: 'whatsapp_comunidade', chatId: '1204@g.us', linkConvite: null, telefoneAdmin: null, ativo: true, totalEnvios: 0, podeGerenciar: true },
    ]);
    mocks.fetchBotChats.mockReset().mockResolvedValue([
      { chatId: '1203@g.us', nome: 'Anúncios · Aurora', tipo: 'grupo', sessaoTelefone: '32999990001', vistoEm: '2026-08-21T10:00:00Z' },
      { chatId: '1204@g.us', nome: 'Avisos do Centro', tipo: 'grupo', comunidadeNome: 'Bairros de Aurora', sessaoTelefone: '32999990001', vistoEm: '2026-08-21T10:00:00Z' },
    ]);
    mocks.fetchSessoesBot.mockReset().mockResolvedValue([
      { id: 's-1', telefone: '32999990001', status: 'vinculado', vinculadoPorNome: 'Paulo', criadoEm: '2026-08-21T09:00:00Z', vinculadoEm: '2026-08-21T09:05:00Z', totalChats: 3 },
    ]);
    mocks.saveComunicado.mockReset().mockResolvedValue('com-new');
    mocks.setComunicadoStatus.mockReset().mockResolvedValue(undefined);
    mocks.dispararBot.mockReset().mockResolvedValue(1);
    mocks.can.mockReset().mockReturnValue(false);
  });
  afterEach(cleanup);

  it('lista comunicados publicados com destino e leituras', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Comunicados' })).toBeVisible();
    expect(await screen.findByText('Limpeza de canal programada')).toBeVisible();
    expect(screen.getByText('Publicados (1)')).toBeVisible();
    expect(screen.getByText(/Centro/)).toBeVisible();
    expect(screen.getByText(/4 leituras/)).toBeVisible();
    expect(screen.getByText('Não lido')).toBeVisible();
  });

  it('expõe formulário, comunidades, números do bot e agendados para quem pode gerenciar', async () => {
    mocks.can.mockReturnValue(true);
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Novo comunicado' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Bairros do município' })).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Comunidades WhatsApp' })).toBeVisible();
    expect((await screen.findAllByText('Comunidade Aurora'))[0]).toBeVisible();
    expect(screen.getByRole('heading', { name: 'Números do bot' })).toBeVisible();
    expect(await screen.findByText('32999990001')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Vincular número' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Salvar rascunho' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Agendar' })).toBeEnabled();
    expect(screen.getByText('Agendados (1)')).toBeVisible();
    expect(screen.getByText('Mutirão de limpeza')).toBeVisible();
  });

  it('mostra modo leitura para papéis sem permissão de escrita', async () => {
    renderPage();
    expect(await screen.findByRole('heading', { name: 'Modo leitura' })).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Salvar rascunho' })).not.toBeInTheDocument();
  });

  it('publica e dispara automaticamente para vários grupos selecionados', async () => {
    const user = userEvent.setup();
    mocks.can.mockReturnValue(true);
    renderPage();
    await screen.findByRole('heading', { name: 'Novo comunicado' });

    await user.type(screen.getByLabelText('Título'), 'Aviso de emergência');
    await user.type(screen.getByLabelText('Conteúdo'), 'Evite as áreas de alagamento.');
    await user.click(await screen.findByRole('checkbox', { name: /Comunidade Aurora/i }));
    await user.click(screen.getByRole('checkbox', { name: /Grupo Centro/i }));
    expect(screen.getByRole('checkbox', { name: 'Disparar pelo WhatsApp ao publicar' })).toBeChecked();

    await user.click(screen.getAllByRole('button', { name: 'Publicar agora' })[0]);

    await waitFor(() => {
      expect(mocks.setComunicadoStatus).toHaveBeenCalledWith('com-new', 'publicado');
      expect(mocks.dispararBot).toHaveBeenNthCalledWith(1, 'com-new', 'k-1');
      expect(mocks.dispararBot).toHaveBeenNthCalledWith(2, 'com-new', 'k-2');
    });
    expect(await screen.findByRole('status')).toHaveTextContent('2 grupos ou comunidades na fila do WhatsApp');
  });

  it('filtra destinos e permite enviar somente para os grupos desejados', async () => {
    const user = userEvent.setup();
    mocks.can.mockReturnValue(true);
    renderPage();
    await screen.findByRole('checkbox', { name: /Comunidade Aurora/i });

    await user.type(screen.getByRole('textbox', { name: 'Filtrar grupos e comunidades do WhatsApp' }), 'Centro');

    expect(screen.queryByRole('checkbox', { name: /Comunidade Aurora/i })).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Grupo Centro/i })).toBeVisible();
  });

  it('mantém a estrutura acessível', async () => {
    const { container } = renderPage();
    await screen.findByText('Limpeza de canal programada');
    expect((await axe(container)).violations).toEqual([]);
  });
});
