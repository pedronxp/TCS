/** Runs the actual Edge PDF generator with in-memory storage and a recording PDF engine. */
const mockDownloads: string[] = [];
const mockEmbedded: number[][] = [];
const mockText: string[] = [];
jest.mock('https://esm.sh/@supabase/supabase-js@2.100.0', () => ({
  createClient: () => ({ storage: { from: () => ({ download: async (path: string) => {
    mockDownloads.push(path);
    const marker = path.includes('primary') ? 11 : 22;
    return { data: { arrayBuffer: async () => new Uint8Array([marker]).buffer }, error: null };
  } }) } }),
}), { virtual: true });
jest.mock('https://esm.sh/pdf-lib@1.17.1', () => ({
  PDFDocument: { create: async () => {
    const pages: any[] = [];
    const image = () => ({ scaleToFit: () => ({ width: 100, height: 60 }) });
    return {
      embedFont: async () => ({ widthOfTextAtSize: (text: string) => text.length * 4 }),
      embedJpg: async (bytes: Uint8Array) => { mockEmbedded.push(Array.from(bytes)); return image(); },
      embedPng: async (bytes: Uint8Array) => { mockEmbedded.push(Array.from(bytes)); return image(); },
      addPage: () => { const page = { drawImage: jest.fn(), drawLine: jest.fn(), drawRectangle: jest.fn(), drawText: (text: string) => mockText.push(text) }; pages.push(page); return page; },
      getPageCount: () => pages.length, getPages: () => pages,
      setTitle: jest.fn(), setCreator: jest.fn(), setProducer: jest.fn(), setSubject: jest.fn(),
      save: async () => new Uint8Array([37, 80, 68, 70]),
    };
  } },
  StandardFonts: { Helvetica: 'regular', HelveticaBold: 'bold' }, rgb: (...value: number[]) => value,
}), { virtual: true });
jest.mock('../../supabase/functions/_shared/defesaCivilLogo', () => ({ DEFESA_CIVIL_LOGO_BASE64: 'data:image/jpeg;base64,TA==' }));
jest.mock('../../supabase/functions/_shared/exifGps', () => ({ readExifGeo: () => null, formatGeoForDocument: () => null }));

describe('preserved PDF evidence integration', () => {
  let buildPdf: (inspection: Record<string, unknown>) => Promise<Uint8Array>;
  beforeAll(() => {
    (globalThis as any).Deno = { env: { get: () => 'test' }, serve: jest.fn() };
    // require keeps Deno-only remote import typings outside the mobile compiler.
    buildPdf = require('../../supabase/functions/generate-inspection-laudo/index').buildPdf;
  });
  afterAll(() => { delete (globalThis as any).Deno; });
  beforeEach(() => { mockDownloads.length = 0; mockEmbedded.length = 0; mockText.length = 0; });
  it('embeds primary and extras even when extras is an array', async () => {
    await buildPdf({ id: 'inspection', protocolo: 'TCS-1', fotoUrl: 'fotos:primary.jpg', fotosUrls: ['fotos:extra.jpg'] });
    expect(mockDownloads).toEqual(['primary.jpg', 'extra.jpg']);
    expect(mockEmbedded).toContainEqual([11]);
    expect(mockEmbedded).toContainEqual([22]);
    expect(mockText).toContain('REGISTRO FOTOGRÁFICO (2)');
  });
  it('does not repeat the primary when a legacy list also includes it', async () => {
    await buildPdf({ id: 'inspection', fotoUrl: 'fotos:primary.jpg', fotosUrls: ['fotos:primary.jpg'] });
    expect(mockDownloads).toEqual(['primary.jpg']);
    expect(mockEmbedded.filter(bytes => bytes[0] === 11)).toHaveLength(1);
  });
});
