jest.mock('expo-crypto', () => {
  const nodeCrypto = require('crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
    CryptoEncoding: { HEX: 'hex' },
    digest: async (_algorithm: string, data: Uint8Array) => {
      if (!(data instanceof Uint8Array)) {
        throw new Error('expo-crypto no iOS exige TypedArray');
      }
      const digest = nodeCrypto.createHash('sha256').update(data).digest();
      return digest.buffer.slice(digest.byteOffset, digest.byteOffset + digest.byteLength);
    },
    digestStringAsync: async (_algorithm: string, data: string) =>
      nodeCrypto.createHash('sha256').update(data, 'utf8').digest('hex'),
  };
});

import * as Crypto from 'expo-crypto';
import {
  canonicalize,
  createDocumentSnapshot,
  hasMinimumSignature,
  hashCanonical,
  sha256Bytes,
} from '../documentIntegrity';

describe('documentIntegrity', () => {
  it('canonicaliza objetos equivalentes independentemente da ordem das chaves', () => {
    expect(canonicalize({ b: 2, a: { z: 1, y: true } }))
      .toBe(canonicalize({ a: { y: true, z: 1 }, b: 2 }));
  });

  it('produz o vetor SHA-256 conhecido para bytes', async () => {
    const bytes = new TextEncoder().encode('abc');
    await expect(sha256Bytes(bytes)).resolves.toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
    );
  });

  it('mantém hash de conteúdo igual e altera ao modificar o snapshot', async () => {
    const first = createDocumentSnapshot('report', 'v1', 'vistoria-1', false, {
      endereco: 'Rua A',
      risco: 2,
    });
    const same = createDocumentSnapshot('report', 'v1', 'vistoria-1', false, {
      risco: 2,
      endereco: 'Rua A',
    });
    const changed = createDocumentSnapshot('report', 'v1', 'vistoria-1', false, {
      risco: 3,
      endereco: 'Rua A',
    });

    await expect(hashCanonical(first)).resolves.toBe(await hashCanonical(same));
    await expect(hashCanonical(changed)).resolves.not.toBe(await hashCanonical(first));
  });

  it('diferencia os bytes de arquivos distintos', async () => {
    const first = await sha256Bytes(new Uint8Array([1, 2, 3]));
    const second = await sha256Bytes(new Uint8Array([1, 2, 4]));
    expect(first).not.toBe(second);
    expect(Crypto.CryptoDigestAlgorithm.SHA256).toBe('SHA-256');
  });

  it('rejeita rubrica vazia e aceita traço com extensão mínima', () => {
    expect(hasMinimumSignature([{ points: [{ x: 0.1, y: 0.1 }] }])).toBe(false);
    expect(hasMinimumSignature([{
      points: [
        { x: 0.1, y: 0.2 }, { x: 0.15, y: 0.25 }, { x: 0.2, y: 0.3 },
        { x: 0.3, y: 0.4 }, { x: 0.4, y: 0.35 }, { x: 0.5, y: 0.3 },
        { x: 0.6, y: 0.25 }, { x: 0.7, y: 0.2 },
      ],
    }])).toBe(true);
  });
});
