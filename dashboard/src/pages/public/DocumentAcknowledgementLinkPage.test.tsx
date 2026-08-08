// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/supabase', () => ({ supabaseConfigurationAvailable: true }));

beforeAll(() => {
  vi.stubEnv('VITE_SUPABASE_URL', 'https://visual-regression.invalid');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'public-test-key');

  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    value: vi.fn().mockReturnValue({ matches: true }),
  });

  globalThis.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };

  Object.defineProperty(HTMLCanvasElement.prototype, 'getBoundingClientRect', {
    configurable: true,
    value: () => ({
      x: 0, y: 0, left: 0, top: 0, right: 400, bottom: 192,
      width: 400, height: 192, toJSON: () => ({}),
    }),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'setPointerCapture', {
    configurable: true,
    value: vi.fn(),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'hasPointerCapture', {
    configurable: true,
    value: vi.fn().mockReturnValue(false),
  });
  Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
    configurable: true,
    value: vi.fn().mockReturnValue({
      setTransform: vi.fn(), clearRect: vi.fn(), beginPath: vi.fn(),
      moveTo: vi.fn(), lineTo: vi.fn(), stroke: vi.fn(),
      set strokeStyle(_value: string) {},
      set lineWidth(_value: number) {},
      set lineCap(_value: string) {},
      set lineJoin(_value: string) {},
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('ciência eletrônica por link', () => {
  it('captura o primeiro traço sem perder a referência do canvas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        document: {
          type: 'report',
          protocol: 'TCS-CAT-2026-00076',
          address: 'Rua Marlene, 531',
        },
        signed_url: 'https://example.invalid/document.pdf',
      }),
    }));

    const { DocumentAcknowledgementLinkPage } = await import('./DocumentAcknowledgementLinkPage');
    render(
      <MemoryRouter initialEntries={['/ciencia/test-token']}>
        <Routes>
          <Route path="/ciencia/:token" element={<DocumentAcknowledgementLinkPage />} />
        </Routes>
      </MemoryRouter>,
    );

    const canvas = await screen.findByLabelText('Área para assinatura manuscrita');
    fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 40, clientY: 70 });
    fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 140, clientY: 100 });
    fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 140, clientY: 100 });

    await waitFor(() => expect(screen.getByText('Assinatura capturada')).toBeVisible());
    expect(screen.queryByText('Assine dentro desta área')).not.toBeInTheDocument();
  });
});
