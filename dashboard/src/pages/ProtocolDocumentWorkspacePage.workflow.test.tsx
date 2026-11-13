// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ProtocolDocumentWorkspacePage } from './ProtocolDocumentWorkspacePage';

const mocks = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn(), upload: vi.fn() }));
vi.mock('@/lib/supabase', () => ({ supabase: { rpc: mocks.rpc, functions: { invoke: mocks.invoke }, storage: { from: () => ({ uploadToSignedUrl: mocks.upload }) } } }));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { id: 'owner' } }) }));
vi.mock('../../../utils/laudoPdfBuilder', () => ({ BASE_LEGAL_PADRAO: 'Base legal', buildLaudoHtml: vi.fn(), buildTermoInterdicaoHtml: vi.fn() }));

const detail = {
  id: 'inspection-1', protocol: 'TCS-1', documents: { report: false, laudo: false, term: false },
  agent_name: 'Pedro', agent_uid: 'pedro', risk_level: 'r4', can_view_sensitive: true, photo_count: 1,
  photo_urls: ['fotos:users/pedro/inspection-1/photos/a.jpg'],
  media_status: { expected_count: 3, available_count: 1, pending_count: 2, revision: 10,
    manifest: { version: 1, revision: 10, expected: 3, available: 1, items: [
      { id: 'a', position: 0, state: 'available', storagePath: 'fotos:users/pedro/inspection-1/photos/a.jpg' },
      { id: 'b', position: 1, state: 'pending', storagePath: null },
      { id: 'c', position: 2, state: 'pending', storagePath: null },
    ] } },
};
function setup(kind: 'relatorio' | 'fotos') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={['/inspection/inspection-1']}><Routes><Route path="/inspection/:inspectionId" element={<ProtocolDocumentWorkspacePage kind={kind} />} /></Routes></MemoryRouter></QueryClientProvider>);
}
describe('owner inspection web workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rpc.mockImplementation(async (name: string) => name === 'get_internal_protocol_inspection' ? { data: detail, error: null }
      : name === 'create_document_acknowledgement_link' ? { data: [{ token: 'a'.repeat(64), expires_at: '2026-11-12T10:00:00Z' }], error: null } : { data: null, error: null });
    mocks.invoke.mockImplementation(async (name: string) => name === 'generate-inspection-laudo'
      ? { data: { ok: true, document_id: 'document-1', document_version: 2, issuance_status: 'preliminary', signed_url: 'https://example.test/document.pdf' }, error: null }
      : { data: { bucket: 'fotos', path: 'users/owner/inspection-1/photos/new.jpg', token: 'upload', persistencePath: 'fotos:users/owner/inspection-1/photos/new.jpg' }, error: null });
    mocks.upload.mockResolvedValue({ error: null });
  });
  afterEach(cleanup);
  it('owner preserves a preliminary version and starts science without signing as Pedro', async () => {
    setup('relatorio');
    await userEvent.click(await screen.findByRole('button', { name: /Gerar e preservar versão PDF/i }));
    expect(mocks.invoke).toHaveBeenCalledWith('generate-inspection-laudo', expect.objectContaining({ body: expect.objectContaining({ issuance_status: 'preliminary', technical_signature_strokes: null }) }));
    expect(await screen.findByRole('link', { name: 'Abrir PDF preservado' })).toHaveAttribute('href', 'https://example.test/document.pdf');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: /Final —/ })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Coletar ciência desta versão' }));
    const link = await screen.findByRole('link', { name: 'Abrir coleta com morador' });
    expect(link.getAttribute('href')).toContain(`/ciencia/${'a'.repeat(64)}`);
  });
  it('shows incomplete state and attaches an authorized replacement without modifying a signed document', async () => {
    setup('fotos');
    expect(await screen.findByText('1 de 3 fotos disponíveis · 2 pendentes')).toBeInTheDocument();
    const file = new File(['photo'], 'photo.jpg', { type: 'image/jpeg' });
    await userEvent.click(screen.getByRole('button', { name: 'Substituir foto pendente' }));
    await userEvent.upload(screen.getByLabelText('Selecionar evidência fotográfica'), file);
    await waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith('update_inspection_media', expect.objectContaining({ p_media_manifest: expect.objectContaining({ expected: 3, available: 2, base_revision: 10 }) })));
    expect(mocks.invoke).not.toHaveBeenCalledWith('generate-inspection-laudo', expect.anything());
  });
});
