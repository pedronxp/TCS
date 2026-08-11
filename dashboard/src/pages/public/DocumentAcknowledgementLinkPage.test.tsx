// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { axe } from 'vitest-axe';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

const themeCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

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
  it('mantém o carregamento estático sob movimento reduzido', async () => {
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(() => undefined)));
    const { DocumentAcknowledgementLinkPage } = await import('./DocumentAcknowledgementLinkPage');
    const { container } = render(
      <MemoryRouter initialEntries={['/ciencia/test-token']}>
        <Routes><Route path="/ciencia/:token" element={<DocumentAcknowledgementLinkPage />} /></Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Carregando documento seguro…')).toBeVisible();
    expect(container.querySelector('.animate-spin')).toHaveClass('motion-reduce:animate-none');
  });

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

  it.each([
    ['ponteiro', (canvas: HTMLElement) => {
      fireEvent.pointerDown(canvas, { pointerId: 1, clientX: 40, clientY: 70 });
      fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 40, clientY: 70 });
    }],
    ['teclado', (canvas: HTMLElement) => {
      fireEvent.keyDown(canvas, { key: 'Enter' });
      fireEvent.keyDown(canvas, { key: 'Enter' });
    }],
  ] as const)('não aceita traço invisível criado por %s', async (_input, createInvisibleStroke) => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        document: { type: 'report', protocol: 'TCS-CAT-2026-00076', address: 'Rua Marlene, 531' },
        signed_url: 'https://example.invalid/document.pdf',
      }),
    });
    vi.stubGlobal('fetch', fetchMock);

    const { DocumentAcknowledgementLinkPage } = await import('./DocumentAcknowledgementLinkPage');
    render(
      <MemoryRouter initialEntries={['/ciencia/test-token']}>
        <Routes><Route path="/ciencia/:token" element={<DocumentAcknowledgementLinkPage />} /></Routes>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByRole('textbox', { name: /nome completo/i }), { target: { value: 'Maria da Silva' } });
    fireEvent.click(screen.getByRole('checkbox'));
    const canvas = screen.getByRole('application', { name: /área para assinatura manuscrita/i });
    createInvisibleStroke(canvas);

    expect(screen.queryByText('Assinatura capturada')).not.toBeInTheDocument();
    expect(screen.getByText('Assine dentro desta área')).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Registrar ciência e assinatura' }));
    expect(screen.getByRole('alert')).toHaveTextContent(/faça a assinatura/i);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('permite iniciar, estender, finalizar, limpar e enviar assinatura pelo teclado', async () => {
    let resolveSubmission!: (value: {
      ok: boolean;
      json: () => Promise<{ ok: boolean; result: { protocol: string } }>;
    }) => void;
    const submissionResponse = new Promise<{
      ok: boolean;
      json: () => Promise<{ ok: boolean; result: { protocol: string } }>;
    }>((resolve) => { resolveSubmission = resolve; });
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          document: { type: 'report', protocol: 'TCS-CAT-2026-00076', address: 'Rua Marlene, 531' },
          signed_url: 'https://example.invalid/document.pdf',
        }),
      })
      .mockReturnValueOnce(submissionResponse);
    vi.stubGlobal('fetch', fetchMock);

    const { DocumentAcknowledgementLinkPage } = await import('./DocumentAcknowledgementLinkPage');
    render(
      <MemoryRouter initialEntries={['/ciencia/test-token']}>
        <Routes><Route path="/ciencia/:token" element={<DocumentAcknowledgementLinkPage />} /></Routes>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByRole('textbox', { name: /nome completo/i }), { target: { value: 'Maria da Silva' } });
    fireEvent.click(screen.getByRole('checkbox'));
    const canvas = screen.getByRole('application', { name: /área para assinatura manuscrita/i });
    canvas.focus();
    expect(canvas).toHaveFocus();
    expect(canvas).toHaveAccessibleDescription(/enter ou espaço para iniciar/i);

    fireEvent.keyDown(canvas, { key: 'Enter' });
    fireEvent.keyDown(canvas, { key: 'ArrowRight' });
    fireEvent.keyDown(canvas, { key: 'ArrowDown' });
    fireEvent.keyDown(canvas, { key: 'Enter' });
    expect(screen.getByRole('status')).toHaveTextContent(/traço finalizado/i);
    fireEvent.keyDown(canvas, { key: 'Delete' });
    expect(screen.getByRole('status')).toHaveTextContent(/assinatura limpa/i);

    fireEvent.keyDown(canvas, { key: ' ' });
    fireEvent.keyDown(canvas, { key: 'ArrowLeft' });
    fireEvent.keyDown(canvas, { key: 'ArrowUp' });
    fireEvent.keyDown(canvas, { key: ' ' });
    const submitButton = screen.getByRole('button', { name: 'Registrar ciência e assinatura' });
    fireEvent.click(submitButton);

    expect(submitButton.querySelector('.animate-spin')).toHaveClass('motion-reduce:animate-none');
    resolveSubmission({
      ok: true,
      json: async () => ({ ok: true, result: { protocol: 'ACK-KEYBOARD-0042' } }),
    });
    expect(await screen.findByText('ACK-KEYBOARD-0042')).toBeVisible();
    const payload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(payload.signature_strokes).toEqual([{
      points: [
        { x: 0.5, y: 0.5 },
        { x: 0.44, y: 0.5 },
        { x: 0.44, y: 0.44 },
      ],
    }]);
  });

  it.each([
    ['resposta sem documento', { ok: true, signed_url: 'https://example.invalid/document.pdf' }],
    ['tipo vazio', {
      ok: true,
      document: { type: ' ', protocol: null, address: null },
      signed_url: 'https://example.invalid/document.pdf',
    }],
    ['protocolo não textual', {
      ok: true,
      document: { type: 'report', protocol: 42, address: null },
      signed_url: 'https://example.invalid/document.pdf',
    }],
    ['endereço não textual', {
      ok: true,
      document: { type: 'report', protocol: null, address: { street: 'Rua Marlene' } },
      signed_url: 'https://example.invalid/document.pdf',
    }],
    ['URL não HTTPS', {
      ok: true,
      document: { type: 'report', protocol: null, address: null },
      signed_url: 'http://example.invalid/document.pdf',
    }],
  ])('fecha o fluxo quando action:view retorna %s', async (_label, response) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => response,
    }));

    const { DocumentAcknowledgementLinkPage } = await import('./DocumentAcknowledgementLinkPage');
    render(
      <MemoryRouter initialEntries={['/ciencia/test-token']}>
        <Routes><Route path="/ciencia/:token" element={<DocumentAcknowledgementLinkPage />} /></Routes>
      </MemoryRouter>,
    );

    expect(await screen.findByRole('heading', { name: 'Link indisponível' })).toBeVisible();
    expect(screen.queryByTitle('Documento apresentado')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Registrar ciência e assinatura' })).not.toBeInTheDocument();
  });

  it.each([
    ['Registrar recusa', 'Motivo da recusa', 'Recusa registrada', 'refused'],
    ['Informar impossibilidade', 'Pessoa impossibilitada de assinar', 'Impossibilidade registrada', 'unable_to_sign'],
  ])('apresenta o resultado real de %s com protocolo auditável', async (option, reason, heading, outcome) => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          ok: true,
          document: { type: 'report', protocol: 'TCS-CAT-2026-00076', address: 'Rua Marlene, 531' },
          signed_url: 'https://example.invalid/document.pdf',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, result: { protocol: 'ACK-2026-0042' } }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const { DocumentAcknowledgementLinkPage } = await import('./DocumentAcknowledgementLinkPage');
    render(
      <MemoryRouter initialEntries={['/ciencia/test-token']}>
        <Routes><Route path="/ciencia/:token" element={<DocumentAcknowledgementLinkPage />} /></Routes>
      </MemoryRouter>,
    );

    fireEvent.change(await screen.findByRole('textbox', { name: /nome completo/i }), { target: { value: 'Maria da Silva' } });
    fireEvent.click(screen.getByRole('button', { name: new RegExp(option, 'i') }));
    fireEvent.change(screen.getByRole('textbox', { name: /informe o motivo/i }), { target: { value: reason } });
    fireEvent.click(screen.getByRole('button', { name: option === 'Registrar recusa' ? 'Registrar recusa' : 'Registrar impossibilidade' }));

    expect(await screen.findByRole('heading', { name: heading })).toBeVisible();
    expect(screen.getByText('ACK-2026-0042')).toBeVisible();
    const payload = JSON.parse(String(fetchMock.mock.calls[1][1]?.body));
    expect(payload).toMatchObject({ outcome, reason, signature_strokes: null });
  });

  it('mantém documento, iframe e evidência estáveis ao alternar o resultado', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        document: { type: 'report', protocol: 'TCS-CAT-2026-00076', address: 'Rua Marlene, 531' },
        signed_url: 'https://example.invalid/document.pdf',
      }),
    }));
    const { DocumentAcknowledgementLinkPage } = await import('./DocumentAcknowledgementLinkPage');
    render(
      <MemoryRouter initialEntries={['/ciencia/test-token']}>
        <Routes><Route path="/ciencia/:token" element={<DocumentAcknowledgementLinkPage />} /></Routes>
      </MemoryRouter>,
    );

    const iframe = await screen.findByTitle('Documento apresentado');
    expect(iframe).toHaveAttribute('src', 'https://example.invalid/document.pdf');
    const toggle = screen.getByRole('button', { name: 'Ocultar prévia' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAttribute('aria-controls', 'document-preview');
    fireEvent.click(toggle);
    expect(screen.getByRole('button', { name: 'Ver prévia aqui' })).toHaveAttribute('aria-expanded', 'false');
    expect(document.getElementById('document-preview')).not.toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Ver prévia aqui' }));
    fireEvent.click(screen.getByRole('button', { name: /registrar recusa/i }));
    expect(screen.getByTitle('Documento apresentado')).toBe(iframe);
    expect(screen.getByText('TCS-CAT-2026-00076')).toBeVisible();
    expect(screen.getByText(/mesma versão do documento/i)).toBeVisible();
  });

  it('não apresenta violações automatizadas de acessibilidade', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ok: true,
        document: { type: 'report', protocol: 'TCS-CAT-2026-00076', address: 'Rua Marlene, 531' },
        signed_url: 'https://example.invalid/document.pdf',
      }),
    }));
    const { DocumentAcknowledgementLinkPage } = await import('./DocumentAcknowledgementLinkPage');
    const { container } = render(
      <MemoryRouter initialEntries={['/ciencia/test-token']}>
        <Routes><Route path="/ciencia/:token" element={<DocumentAcknowledgementLinkPage />} /></Routes>
      </MemoryRouter>,
    );
    await screen.findByRole('heading', { name: 'Ciência eletrônica' });
    expect((await axe(container, { iframes: false })).violations).toEqual([]);
  });

  it('mantém contraste AA determinístico do token primário nos temas claro e escuro', () => {
    expect(themeCss).toContain('--primary: 152.449 70% 27.451%;');
    const lightPrimary = hslToRgb([152.449, 70, 27.451]);
    const lightBackground = hslToRgb([0, 0, 98]);
    const lightCard = hslToRgb([0, 0, 100]);
    const darkPrimary = hslToRgb([158, 60, 45]);
    const darkBackground = hslToRgb([0, 0, 9]);
    const darkCard = hslToRgb([0, 0, 12]);
    const darkPrimaryForeground = hslToRgb([0, 0, 9]);

    expect(contrastRatio(lightPrimary, lightBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(lightPrimary, blend(lightPrimary, lightCard, 0.1))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(lightPrimary, [1, 1, 1])).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkPrimary, darkBackground)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkPrimary, blend(darkPrimary, darkCard, 0.1))).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(darkPrimary, darkPrimaryForeground)).toBeGreaterThanOrEqual(4.5);
  });
});

type Hsl = readonly [number, number, number];
type Rgb = readonly [number, number, number];

function hslToRgb([hue, saturationValue, lightnessValue]: Hsl): Rgb {
  const saturation = saturationValue / 100;
  const lightness = lightnessValue / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = hue / 60;
  const secondary = chroma * (1 - Math.abs((section % 2) - 1));
  const offset = lightness - chroma / 2;
  const channels = section < 1 ? [chroma, secondary, 0]
    : section < 2 ? [secondary, chroma, 0]
      : section < 3 ? [0, chroma, secondary]
        : section < 4 ? [0, secondary, chroma]
          : section < 5 ? [secondary, 0, chroma]
            : [chroma, 0, secondary];
  return channels.map((channel) => channel + offset) as [number, number, number];
}

function blend(foreground: Rgb, background: Rgb, alpha: number): Rgb {
  return foreground.map((channel, index) => channel * alpha + background[index] * (1 - alpha)) as [number, number, number];
}

function relativeLuminance(rgb: Rgb) {
  const [red, green, blue] = rgb.map((channel) => channel <= 0.04045
    ? channel / 12.92
    : ((channel + 0.055) / 1.055) ** 2.4);
  return 0.2126 * red + 0.7152 * green + 0.0722 * blue;
}

function contrastRatio(foreground: Rgb, background: Rgb) {
  const foregroundLuminance = relativeLuminance(foreground);
  const backgroundLuminance = relativeLuminance(background);
  return (Math.max(foregroundLuminance, backgroundLuminance) + 0.05)
    / (Math.min(foregroundLuminance, backgroundLuminance) + 0.05);
}
