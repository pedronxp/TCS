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
  requestBotPairingCode: vi.fn(),
  saveCanal: vi.fn(),
  setCanalAtivo: vi.fn(),
  deleteCanal: vi.fn(),
  vincularCanalChat: vi.fn(),
  operarSessaoBot: vi.fn(),
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
    mocks.requestBotPairingCode.mockReset().mockResolvedValue('ABCD-1234');
    mocks.saveCanal.mockReset().mockResolvedValue('channel-new');
    mocks.setCanalAtivo.mockReset().mockResolvedValue(undefined);
    mocks.deleteCanal.mockReset().mockResolvedValue(undefined);
    mocks.vincularCanalChat.mockReset().mockResolvedValue(undefined);
    mocks.operarSessaoBot.mockReset().mockResolvedValue(undefined);
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
    expect(mocks.fetchBotChats).not.toHaveBeenCalled();
  });

  it('permite escolher QR Code ou gerar um código pelo número do telefone', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.click(await screen.findByRole('button', { name: 'Conectar número' }));

    expect(await screen.findByRole('button', { name: /usar qr code/i })).toBeVisible();
    await user.click(screen.getByRole('button', { name: /usar código de vinculação/i }));
    await user.type(screen.getByLabelText(/telefone do whatsapp/i), '32984792322');
    await user.click(screen.getByRole('button', { name: /gerar código/i }));

    expect(await screen.findByText('ABCD-1234')).toBeVisible();
    expect(mocks.requestBotPairingCode).toHaveBeenCalledWith('session-new', '32984792322');
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
