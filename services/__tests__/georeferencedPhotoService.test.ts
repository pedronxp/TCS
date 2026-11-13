/**
 * Testes do serviço de captura georreferenciada.
 *
 * O foco é a lógica de decisão — qual coordenada vale, em que ordem e o que
 * acontece quando o GPS falha — porque é aí que mora o risco de uma prova
 * falsa: foto da galeria anotada com a posição atual do agente seria
 * incorreto e não poderia ser detectado depois.
 */

jest.mock('expo-image-picker', () => ({
  requestCameraPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  launchCameraAsync: jest.fn(async () => ({ canceled: true, assets: [] })),
}));

jest.mock('expo-location', () => ({
  Accuracy: { High: 4, Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
  getCurrentPositionAsync: jest.fn(),
  getLastKnownPositionAsync: jest.fn(),
}));

jest.mock('../photoStampService', () => ({
  criarCarimboFoto: jest.fn(async () => ({ endereco: null, linhas: ['GPS -23.550500, -46.633300'] })),
  aplicarCarimboFoto: jest.fn(async ({ uri }: { uri: string }) => uri),
}));

jest.mock('expo-file-system', () => {
  const store = new Map<string, Uint8Array>();
  return {
    Paths: { cache: 'file:///cache/' },
    File: class {
      uri: string;
      constructor(uri: string) {
        this.uri = uri;
      }
      get exists(): boolean {
        return store.has(this.uri);
      }
      bytes(): Promise<Uint8Array> {
        const found = store.get(this.uri);
        if (!found) throw new Error('arquivo inexistente');
        return Promise.resolve(found);
      }
      base64(): Promise<string> {
        return Promise.resolve(
          Array.from(store.get(this.uri) ?? [])
            .map(byte => String.fromCharCode(byte))
            .join(''),
        );
      }
      write(content: Uint8Array): void {
        store.set(this.uri, content);
      }
      delete(): void {
        store.delete(this.uri);
      }
      static downloadFileAsync(url: string, destination: { uri: string }): Promise<{ uri: string }> {
        const found = store.get(url);
        if (found) store.set(destination.uri, found);
        return Promise.resolve({ uri: destination.uri });
      }
    },
    __store: store,
  };
});

jest.mock('../../utils/imageCompression', () => ({
  EVIDENCE_IMAGE_MAX_WIDTH: 854,
  compressAndPersistImage: jest.fn(async (uri: string) => uri),
}));

jest.mock('../../utils/documentIntegrity', () => {
  const nodeCrypto = require('crypto');
  return {
    sha256Bytes: jest.fn(async (bytes: Uint8Array) =>
      nodeCrypto.createHash('sha256').update(bytes).digest('hex'),
    ),
  };
});

import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { buildExifApp1Payload, injectExifSegment, readExifGeo } from '../../supabase/functions/_shared/exifGps';
import {
  capturarFotoGeorreferenciada,
  obterPosicaoAtual,
  registrarGeorreferenciaDaGaleria,
} from '../georeferencedPhotoService';

const mockLocation = Location as jest.Mocked<typeof Location>;
const mockPicker = ImagePicker as jest.Mocked<typeof ImagePicker>;
const mockCompress = require('../../utils/imageCompression') as {
  compressAndPersistImage: jest.Mock;
};

/** JPEG mínimo para os testes. */
function minimalJpeg(): Uint8Array {
  const jfif = [
    0xff, 0xe0, 0x00, 0x10,
    0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00,
  ];
  return new Uint8Array([0xff, 0xd8, ...jfif, 0xff, 0xd9]);
}

/** Registra um arquivo no mock do expo-file-system. */
function storeFile(uri: string, bytes: Uint8Array): void {
  const fs = require('expo-file-system');
  fs.__store.set(uri, bytes);
}

describe('georeferencedPhotoService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const fs = require('expo-file-system');
    fs.__store.clear();
    mockCompress.compressAndPersistImage.mockImplementation(async (uri: string) => uri);
    mockLocation.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as never);
    mockLocation.getLastKnownPositionAsync.mockRejectedValue(new Error('sem posição'));
  });

  describe('obterPosicaoAtual', () => {
    it('devolve a posição do GPS quando obtida', async () => {
      mockLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: { latitude: -23.5505, longitude: -46.6333, accuracy: 8, altitude: 760 },
        timestamp: Date.now(),
      } as never);

      await expect(obterPosicaoAtual()).resolves.toEqual({
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 8,
        altitude: 760,
      });
    });

    it('usa a última posição conhecida apenas quando recente', async () => {
      mockLocation.getCurrentPositionAsync.mockRejectedValue(new Error('sem sinal'));
      mockLocation.getLastKnownPositionAsync.mockResolvedValue({
        coords: { latitude: -23.5, longitude: -46.6, accuracy: 30, altitude: null },
        timestamp: Date.now() - 60_000,
      } as never);

      const posicao = await obterPosicaoAtual();
      expect(posicao?.latitude).toBeCloseTo(-23.5, 6);
    });

    it('descarta a última posição conhecida antiga demais', async () => {
      mockLocation.getCurrentPositionAsync.mockRejectedValue(new Error('sem sinal'));
      mockLocation.getLastKnownPositionAsync.mockResolvedValue({
        coords: { latitude: -23.5, longitude: -46.6, accuracy: 30, altitude: null },
        timestamp: Date.now() - 60 * 60 * 1000,
      } as never);

      await expect(obterPosicaoAtual()).resolves.toBeNull();
    });

    it('descarta coordenadas fora do intervalo válido', async () => {
      mockLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: { latitude: 999, longitude: -46.6, accuracy: 5, altitude: null },
        timestamp: Date.now(),
      } as never);

      await expect(obterPosicaoAtual()).resolves.toBeNull();
    });
  });

  describe('capturarFotoGeorreferenciada', () => {
    it('salva EXIF e hash no JPEG carimbado, mantendo o original intacto', async () => {
      mockLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: { latitude: -23.5505, longitude: -46.6333, accuracy: 8, altitude: 760 },
      } as never);
      mockPicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///original.jpg' }] } as never);
      storeFile('file:///original.jpg', minimalJpeg());
      storeFile('file:///temporaria.jpg', minimalJpeg());
      storeFile('file:///carimbada.jpg', minimalJpeg());
      const stamp = require('../photoStampService');
      stamp.aplicarCarimboFoto.mockResolvedValueOnce('file:///temporaria.jpg');
      mockCompress.compressAndPersistImage.mockResolvedValueOnce('file:///original.jpg').mockResolvedValueOnce('file:///carimbada.jpg');
      const result = await capturarFotoGeorreferenciada();
      expect(result.foto?.uri).toBe('file:///carimbada.jpg');
      const fs = require('expo-file-system');
      expect(readExifGeo(fs.__store.get('file:///original.jpg'))).toBeNull();
      expect(readExifGeo(fs.__store.get('file:///carimbada.jpg'))?.latitude).toBeCloseTo(-23.5505, 6);
      expect(result.foto?.hash).toBe(require('crypto').createHash('sha256').update(fs.__store.get('file:///carimbada.jpg')).digest('hex'));
    });

    it('falha ao persistir carimbo mantém a cópia durável e avisa, sem retornar arquivo temporário', async () => {
      mockLocation.getCurrentPositionAsync.mockRejectedValue(new Error('sem GPS'));
      mockPicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///camera.jpg' }] } as never);
      storeFile('file:///camera.jpg', minimalJpeg());
      storeFile('file:///persistida.jpg', minimalJpeg());
      storeFile('file:///cache/carimbo.jpg', minimalJpeg());
      mockCompress.compressAndPersistImage.mockResolvedValueOnce('file:///persistida.jpg').mockResolvedValueOnce('file:///cache/carimbo.jpg');
      require('../photoStampService').aplicarCarimboFoto.mockResolvedValueOnce('file:///cache/carimbo.jpg');
      const result = await capturarFotoGeorreferenciada();
      expect(result.foto?.uri).toBe('file:///persistida.jpg');
      expect(result.foto?.avisoCarimbo).toBeTruthy();
      expect(require('expo-file-system').__store.has('file:///persistida.jpg')).toBe(true);
    });

    it('falha do carimbo preserva a foto e retorna aviso explícito', async () => {
      mockLocation.getCurrentPositionAsync.mockRejectedValue(new Error('sem GPS'));
      mockPicker.launchCameraAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file:///original.jpg' }] } as never);
      storeFile('file:///original.jpg', minimalJpeg());
      require('../photoStampService').aplicarCarimboFoto.mockRejectedValueOnce(new Error('renderização'));
      const result = await capturarFotoGeorreferenciada();
      expect(result.foto?.uri).toBe('file:///original.jpg');
      expect(result.foto?.avisoCarimbo).toBeTruthy();
    });

    it('grava a posição do GPS no arquivo e devolve o hash', async () => {
      mockLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: { latitude: -23.5505, longitude: -46.6333, accuracy: 8, altitude: 760 },
        timestamp: Date.now(),
      } as never);
      mockPicker.launchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///captura.jpg' }],
      } as never);
      storeFile('file:///captura.jpg', minimalJpeg());

      const resultado = await capturarFotoGeorreferenciada();

      expect(resultado.cancelado).toBe(false);
      expect(resultado.foto?.semGeorreferencia).toBe(false);

      // O arquivo gravado carrega a coordenada — verificável por fora do app.
      const fs = require('expo-file-system');
      const gravado = fs.__store.get('file:///captura.jpg');
      const geo = readExifGeo(gravado);
      expect(geo?.latitude).toBeCloseTo(-23.5505, 6);
      expect(geo?.longitude).toBeCloseTo(-46.6333, 6);
      expect(resultado.foto?.hash).toHaveLength(64);
    });

    it('registra a foto mesmo sem sinal de GPS, marcando-a como sem georreferência', async () => {
      mockLocation.getCurrentPositionAsync.mockRejectedValue(new Error('sem sinal'));
      mockPicker.launchCameraAsync.mockResolvedValue({
        canceled: false,
        assets: [{ uri: 'file:///captura.jpg' }],
      } as never);
      storeFile('file:///captura.jpg', minimalJpeg());

      const resultado = await capturarFotoGeorreferenciada();

      expect(resultado.cancelado).toBe(false);
      expect(resultado.foto?.semGeorreferencia).toBe(true);
      expect(resultado.foto?.hash).toHaveLength(64);
    });

    it('não grava nada quando o usuário cancela', async () => {
      mockPicker.launchCameraAsync.mockResolvedValue({ canceled: true, assets: [] } as never);

      const resultado = await capturarFotoGeorreferenciada();

      expect(resultado.cancelado).toBe(true);
      expect(resultado.foto).toBeUndefined();
    });
  });

  describe('registrarGeorreferenciaDaGaleria', () => {
    it('preserva o EXIF original da foto de galeria', async () => {
      const origem = injectExifSegment(
        minimalJpeg(),
        buildExifApp1Payload({
          latitude: -15.7942,
          longitude: -47.8822,
          capturedAt: '2026-11-01T10:00:00.000Z',
        }),
      );
      storeFile('file:///galeria.jpg', origem);
      mockCompress.compressAndPersistImage.mockResolvedValue('file:///galeria.jpg');

      const foto = await registrarGeorreferenciaDaGaleria('file:///galeria.jpg');

      expect(foto.origem).toBe('galeria');
      expect(foto.semGeorreferencia).toBe(false);
      expect(foto.geo?.latitude).toBeCloseTo(-15.7942, 6);
      expect(foto.geo?.longitude).toBeCloseTo(-47.8822, 6);
    });

    it('NÃO usa o GPS do aparelho para foto de galeria', async () => {
      // Foto de galeria pode ter sido tirada em outro lugar: usar a posição
      // atual do agente produziria uma prova falsa.
      mockLocation.getCurrentPositionAsync.mockResolvedValue({
        coords: { latitude: -23.5505, longitude: -46.6333, accuracy: 5, altitude: null },
        timestamp: Date.now(),
      } as never);
      storeFile('file:///galeria.jpg', minimalJpeg());
      mockCompress.compressAndPersistImage.mockResolvedValue('file:///galeria.jpg');

      const foto = await registrarGeorreferenciaDaGaleria('file:///galeria.jpg');

      expect(foto.semGeorreferencia).toBe(true);
      expect(foto.geo?.latitude).toBeUndefined();
      expect(mockLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
    });
  });
});
