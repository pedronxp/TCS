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
    uploadToSignedUrl: jest.fn().mockResolvedValue({ data: { path: 'path' }, error: null }),
    createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'https://signed.test/file' }, error: null }),
  };
  return {
    supabase: {
      auth: { getSession: jest.fn().mockResolvedValue({ data: { session: { user: { id: '11111111-1111-4111-8111-111111111111' } } }, error: null }) },
      functions: { invoke: jest.fn().mockResolvedValue({ data: {
        bucket: 'fotos',
        path: 'users/11111111-1111-4111-8111-111111111111/vistorias/v-1/foto.jpg',
        token: 'signed-upload-token',
        persistencePath: 'fotos:users/11111111-1111-4111-8111-111111111111/vistorias/v-1/foto.jpg',
        contentType: 'image/jpeg',
      }, error: null }) },
      storage: { from: jest.fn(() => storageApi) },
    },
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
    supabaseModule.__storageApi.uploadToSignedUrl.mockClear();
    supabaseModule.supabase.functions.invoke.mockClear();
    supabaseModule.supabase.functions.invoke.mockResolvedValue({ data: {
      bucket: 'fotos',
      path: 'users/11111111-1111-4111-8111-111111111111/vistorias/v-1/foto.jpg',
      token: 'signed-upload-token',
      persistencePath: 'fotos:users/11111111-1111-4111-8111-111111111111/vistorias/v-1/foto.jpg',
      contentType: 'image/jpeg',
    }, error: null });
  });

  it('preserva URI local para visualização offline e inclusão no PDF', async () => {
    await expect(getSignedUrl('file:///documents/foto.jpg')).resolves.toBe('file:///documents/foto.jpg');
  });

  it('envia os bytes reais da imagem ao Storage', async () => {
    await expect(
      uploadImageFromLocalUri('file:///documents/foto.jpg', 'v-1')
    ).resolves.toBe('fotos:users/11111111-1111-4111-8111-111111111111/vistorias/v-1/foto.jpg');

    expect(supabaseModule.supabase.functions.invoke).toHaveBeenCalledWith('inspection-upload-authorize', {
      body: { inspectionId: 'v-1', kind: 'photo', contentType: 'image/jpeg', documentId: undefined },
    });
    const [path, token, body, options] = supabaseModule.__storageApi.uploadToSignedUrl.mock.calls[0];
    expect(path).toBe('users/11111111-1111-4111-8111-111111111111/vistorias/v-1/foto.jpg');
    expect(token).toBe('signed-upload-token');
    expect(body).toBeInstanceOf(Uint8Array);
    expect(body.byteLength).toBe(4);
    expect(options).toEqual(expect.objectContaining({ contentType: 'image/jpeg' }));
  });

  it('propaga falha de autorização do upload', async () => {
    supabaseModule.supabase.functions.invoke.mockResolvedValueOnce({
      data: null,
      error: new Error('Escopo de Storage inválido'),
    });

    await expect(
      uploadImageFromLocalUri('file:///documents/foto.jpg', 'v-1')
    ).rejects.toThrow('Escopo de Storage inválido');
  });
});
