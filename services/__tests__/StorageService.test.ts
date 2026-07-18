jest.mock('expo-file-system', () => ({
  File: class {
    exists = true;
    uri: string;
    constructor(...parts: string[]) { this.uri = parts.join('/'); }
    async bytes() { return new Uint8Array([10, 20, 30, 40]); }
  },
}));

jest.mock('../../utils/supabase', () => {
  const storageApi = {
    upload: jest.fn().mockResolvedValue({ data: { path: 'path' }, error: null }),
    createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.test/file' }, error: null }),
  };
  return {
    supabase: { storage: { from: jest.fn(() => storageApi) } },
    __storageApi: storageApi,
  };
});

jest.mock('../../utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { getSignedUrl, uploadImageFromLocalUri } from '../StorageService';

const supabaseModule = require('../../utils/supabase');

describe('StorageService', () => {
  beforeEach(() => {
    supabaseModule.__storageApi.upload.mockClear();
  });

  it('preserva URI local para visualização offline e inclusão no PDF', async () => {
    await expect(getSignedUrl('file:///documents/foto.jpg')).resolves.toBe('file:///documents/foto.jpg');
  });

  it('envia os bytes reais da imagem ao Storage', async () => {
    await expect(
      uploadImageFromLocalUri('file:///documents/foto.jpg', 'vistorias/v-1/foto.jpg')
    ).resolves.toBe('fotos:vistorias/v-1/foto.jpg');

    const [, body, options] = supabaseModule.__storageApi.upload.mock.calls[0];
    expect(body).toBeInstanceOf(Uint8Array);
    expect(body.byteLength).toBe(4);
    expect(options).toEqual(expect.objectContaining({ contentType: 'image/jpeg' }));
  });
});
