// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { WhatsAppPairingDialog } from './WhatsAppPairingDialog';

const mocks = vi.hoisted(() => ({
  fetchBotQrObjectUrl: vi.fn(),
  prepareBotSessionPairing: vi.fn(),
  requestBotPairingCode: vi.fn(),
  restartBotSessionPairing: vi.fn(),
}));

vi.mock('@/lib/comunicados', () => mocks);

function renderDialog() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <WhatsAppPairingDialog sessionId="session-qr" open onOpenChange={vi.fn()} />
    </QueryClientProvider>,
  );
}

describe('recuperação do QR Code do WhatsApp', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mocks.prepareBotSessionPairing.mockReset().mockResolvedValue(undefined);
    mocks.requestBotPairingCode.mockReset().mockResolvedValue('ABCD-1234');
    mocks.restartBotSessionPairing.mockReset().mockResolvedValue(undefined);
    mocks.fetchBotQrObjectUrl.mockReset().mockRejectedValue(new Error('O QR Code ainda está sendo preparado.'));
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('reinicia a sessão do bot antes de repetir a leitura após esgotar o polling', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderDialog();

    await user.type(screen.getByLabelText(/número do whatsapp com ddd/i), '32984792322');
    await user.click(screen.getByRole('button', { name: /gerar qr code/i }));

    await waitFor(() => expect(mocks.fetchBotQrObjectUrl).toHaveBeenCalledTimes(1));
    for (let attempt = 0; attempt < 15; attempt += 1) {
      await act(async () => { await vi.advanceTimersByTimeAsync(6_000); });
    }

    const retry = await screen.findByRole('button', { name: /tentar novamente/i });
    await user.click(retry);

    await waitFor(() => expect(mocks.prepareBotSessionPairing).toHaveBeenLastCalledWith({
      sessionId: 'session-qr', phone: '32984792322', identification: '', method: 'qr',
    }));
    await waitFor(() => expect(mocks.restartBotSessionPairing).toHaveBeenCalledWith('session-qr'));
    await waitFor(() => expect(mocks.fetchBotQrObjectUrl).toHaveBeenCalledTimes(16));
  });
});
