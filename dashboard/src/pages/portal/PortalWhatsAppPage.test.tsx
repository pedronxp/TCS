// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PortalWhatsAppPage } from './PortalWhatsAppPage';

const mocks = vi.hoisted(() => ({
  fetchCanais: vi.fn(),
  fetchBotChats: vi.fn(),
  fetchSessoesBot: vi.fn(),
  fetchPortalBotRuntimeStatus: vi.fn(),
  criarSessaoBot: vi.fn(),
  criarSalaTransmissaoPeloBot: vi.fn(),
  fetchBotQrObjectUrl: vi.fn(),
  prepareBotSessionPairing: vi.fn(),
  requestBotPairingCode: vi.fn(),
  restartBotSessionPairing: vi.fn(),
  saveCanal: vi.fn(),
  setCanalAtivo: vi.fn(),
  deleteCanal: vi.fn(),
  vincularCanalChat: vi.fn(),
  operarSessaoBot: vi.fn(),
  removerSessaoBot: vi.fn(),
  openBotQr: vi.fn(),
}));

vi.mock('@/lib/comunicados', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/comunicados')>()),
  ...mocks,
}));
vi.mock('@/contexts/PortalAuthContext', () => ({
  usePortalAuth: () => ({
    access: { organizationId: 'org-1', organizationName: 'Prefeitura de Aurora' },
    can: () => true,
  }),
}));
vi.mock('@/components/tutorial/GuidedTutorial', () => ({ GuidedTutorial: () => null }));

const channel = {
  id: 'channel-1', nome: 'Comunidade Aurora', tipo: 'whatsapp_comunidade',
  chatId: '1203@g.us', linkConvite: 'https://chat.whatsapp.com/example',
  telefoneAdmin: null, ativo: true, totalEnvios: 0, podeGerenciar: true,
};
const session = {
  id: 'session-1', telefone: '55****2322', status: 'vinculado',
  vinculadoPorNome: 'Pedro', criadoEm: null, vinculadoEm: null, totalChats: 2,
};

function runtime(sessionsOnline: number) {
  return {
    organizationId: 'org-1', state: sessionsOnline > 0 ? 'online' : 'offline',
    serviceOnline: true, serviceLastSeenAt: null, lastSeenAt: null, lastTransitionAt: null,
    sessionsTotal: 1, sessionsOnline, sessionsReconnecting: 0, sessionsAwaitingQr: 0,
    sessionsPaused: 0, sessionsOffline: sessionsOnline > 0 ? 0 : 1, sessionsBanned: 0,
    sessions: [{ id: 'session-1', telefone: '55****2322', databaseStatus: 'vinculado',
      runtimeState: sessionsOnline > 0 ? 'online' : 'offline', lastSeenAt: null,
      lastTransitionAt: null, lastError: null }],
  };
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={client}><PortalWhatsAppPage /></QueryClientProvider>);
}

describe('operação segura do WhatsApp municipal', () => {
  beforeEach(() => {
    mocks.fetchCanais.mockReset().mockResolvedValue([channel]);
    mocks.fetchBotChats.mockReset().mockResolvedValue([
      { chatId: '1203@g.us', nome: 'Grupo secreto Aurora', tipo: 'grupo', comunidadeId: null,
        comunidadeNome: null, sessaoTelefone: '55****2322', totalAdmins: 1,
        totalParticipantes: 20, vistoEm: null },
    ]);
    mocks.fetchSessoesBot.mockReset().mockResolvedValue([session]);
    mocks.fetchPortalBotRuntimeStatus.mockReset().mockResolvedValue(runtime(1));
    mocks.criarSessaoBot.mockReset().mockResolvedValue('session-new');
    mocks.criarSalaTransmissaoPeloBot.mockReset().mockResolvedValue({ chatId: '120363000000000001@newsletter', nome: 'Alertas Aurora', inviteUrl: 'https://whatsapp.com/channel/aurora' });
    mocks.fetchBotQrObjectUrl.mockReset().mockResolvedValue('blob:whatsapp-qr');
    mocks.prepareBotSessionPairing.mockReset().mockResolvedValue(undefined);
    mocks.requestBotPairingCode.mockReset().mockResolvedValue('ABCD-1234');
    mocks.restartBotSessionPairing.mockReset().mockResolvedValue(undefined);
    mocks.saveCanal.mockReset().mockResolvedValue('channel-new');
    mocks.setCanalAtivo.mockReset().mockResolvedValue(undefined);
    mocks.deleteCanal.mockReset().mockResolvedValue(undefined);
    mocks.vincularCanalChat.mockReset().mockResolvedValue(undefined);
    mocks.operarSessaoBot.mockReset().mockResolvedValue(undefined);
    mocks.removerSessaoBot.mockReset().mockResolvedValue(undefined);
    mocks.openBotQr.mockReset().mockResolvedValue(undefined);
  });

  afterEach(cleanup);

  it('oculta nomes, grupos e convites quando nenhum número está online', async () => {
    mocks.fetchPortalBotRuntimeStatus.mockResolvedValue(runtime(0));
    renderPage();

    expect(await screen.findByText(/dados protegidos até um número reconectar/i)).toBeVisible();
    expect(screen.queryByText('Comunidade Aurora')).not.toBeInTheDocument();
    expect(screen.queryByText('Grupo secreto Aurora')).not.toBeInTheDocument();
    expect(screen.getByText('Comunidades ativas')).toBeVisible();
    expect(await screen.findByText('0/1')).toBeVisible();
    expect(screen.queryByText(/2 grupos sincronizados/i)).not.toBeInTheDocument();
    expect(mocks.fetchBotChats).not.toHaveBeenCalled();
  });

  it('permite escolher QR Code ou gerar um código pelo número do telefone', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Conectar número' }));

    expect(await screen.findByRole('dialog', { name: /identifique o número/i })).toBeVisible();
    expect(mocks.fetchBotQrObjectUrl).not.toHaveBeenCalled();
    expect(mocks.openBotQr).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: /^código/i }));
    await user.type(screen.getByLabelText(/número do whatsapp com ddd/i), '32984792322');
    await user.click(screen.getByRole('button', { name: /gerar código/i }));

    expect(await screen.findByText('ABCD-1234')).toBeVisible();
    expect(mocks.prepareBotSessionPairing).toHaveBeenCalledWith({ sessionId: 'session-new', phone: '32984792322', identification: '', method: 'code' });
    expect(mocks.requestBotPairingCode).toHaveBeenCalledWith('session-new', '32984792322');
  });

  it('remove um número desconectado somente após confirmação explícita', async () => {
    const user = userEvent.setup();
    mocks.fetchSessoesBot.mockResolvedValue([{ ...session, status: 'desconectado' }]);
    mocks.fetchPortalBotRuntimeStatus.mockResolvedValue(runtime(0));
    renderPage();

    await user.click(await screen.findByRole('button', { name: /mais ações para 55\*\*\*\*2322/i }));
    await user.click(await screen.findByRole('menuitem', { name: 'Remover número' }));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('55****2322');
    expect(mocks.removerSessaoBot).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmar remoção' }));

    await waitFor(() => expect(mocks.removerSessaoBot).toHaveBeenCalledWith('session-1'));
  });

  it('cria uma sala de transmissão oficial somente após confirmar a ação', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.type(await screen.findByLabelText('Nome da sala de transmissão'), 'Alertas Aurora');
    await user.click(screen.getByRole('button', { name: 'Criar sala de transmissão' }));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Alertas Aurora');
    expect(mocks.criarSalaTransmissaoPeloBot).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmar criação' }));

    await waitFor(() => expect(mocks.criarSalaTransmissaoPeloBot).toHaveBeenCalledWith('session-1', 'Alertas Aurora', ''));
    expect(mocks.saveCanal).toHaveBeenCalledWith({ nome: 'Alertas Aurora', linkConvite: 'https://whatsapp.com/channel/aurora' });
    expect(mocks.vincularCanalChat).toHaveBeenCalledWith('channel-new', '120363000000000001@newsletter');
  });

  it('mantém a sala oficial separada dos grupos e identifica a proteção dos participantes', async () => {
    mocks.fetchCanais.mockResolvedValue([
      channel,
      { ...channel, id: 'broadcast-1', nome: 'Avisos protegidos', chatId: '120363000000000001@newsletter' },
    ]);
    mocks.fetchBotChats.mockResolvedValue([
      { chatId: '1203@g.us', nome: 'Grupo secreto Aurora', tipo: 'grupo', comunidadeId: null,
        comunidadeNome: null, sessaoTelefone: '55****2322', totalAdmins: 1, totalParticipantes: 20, vistoEm: null },
      { chatId: '120363000000000001@newsletter', nome: 'Avisos protegidos', tipo: 'transmissao', comunidadeId: null,
        comunidadeNome: null, sessaoTelefone: '55****2322', totalAdmins: 1, totalParticipantes: 20, vistoEm: null },
    ]);
    renderPage();

    expect(await screen.findByText('Avisos protegidos')).toBeVisible();
    expect(screen.getByText(/canal privado/i)).toBeVisible();
    expect(screen.getByRole('combobox', { name: 'Grupo vinculado a Comunidade Aurora' })).not.toHaveTextContent('Avisos protegidos');
  });

  it('exige confirmação antes de criar uma comunidade', async () => {
    const user = userEvent.setup();
    renderPage();

    await screen.findByText('Comunidade Aurora');
    await user.type(screen.getByLabelText('Nome da comunidade'), 'Nova comunidade');
    await user.click(screen.getByRole('button', { name: 'Adicionar' }));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Nova comunidade');
    expect(mocks.saveCanal).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmar criação' }));
    await waitFor(() => expect(mocks.saveCanal).toHaveBeenCalledOnce());
  });

  it('exige confirmação antes de desativar uma comunidade', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Desativar' }));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Comunidade Aurora');
    expect(mocks.setCanalAtivo).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmar desativação' }));
    await waitFor(() => expect(mocks.setCanalAtivo).toHaveBeenCalledWith('channel-1', false));
  });

  it('exige confirmação antes de remover uma comunidade', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Remover Comunidade Aurora' }));

    expect(await screen.findByRole('alertdialog')).toHaveTextContent('Comunidade Aurora');
    expect(mocks.deleteCanal).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Confirmar exclusão' }));
    await waitFor(() => expect(mocks.deleteCanal).toHaveBeenCalledWith('channel-1'));
  });
});
