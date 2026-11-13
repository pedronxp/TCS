// Tipos do módulo nativo `expo-crypto` para o typecheck do console/portal.
//
// Mesmo motivo do shim de `expo-file-system`: o dashboard web não instala os
// pacotes nativos do Expo, mas o typecheck percorre `utils/documentIntegrity.ts`,
// compartilhado com o app, que importa `expo-crypto`.
//
// Estos tipos espelham a API pública real do `expo-crypto` (v57). O CI do
// dashboard instala apenas `dashboard/package-lock.json`, que não traz os
// pacotes do Expo — daí a necessidade deste arquivo.
declare module 'expo-crypto' {
  export enum CryptoDigestAlgorithm {
    SHA1 = 'SHA-1',
    SHA256 = 'SHA-256',
    SHA384 = 'SHA-384',
    SHA512 = 'SHA-512',
    MD5 = 'MD5',
  }

  export enum CryptoEncoding {
    HEX = 'hex',
    BASE64 = 'base64',
  }

  export type CryptoDigestOptions = {
    encoding: CryptoEncoding;
  };

  export function digestStringAsync(
    algorithm: CryptoDigestAlgorithm,
    data: string,
    options?: CryptoDigestOptions,
  ): Promise<string>;

  export function digest(
    algorithm: CryptoDigestAlgorithm,
    data: Uint8Array | ArrayBuffer,
    options?: CryptoDigestOptions,
  ): Promise<Uint8Array>;

  export function getRandomBytes(byteCount: number): Uint8Array;
  export function getRandomBytesAsync(byteCount: number): Promise<Uint8Array>;
}
