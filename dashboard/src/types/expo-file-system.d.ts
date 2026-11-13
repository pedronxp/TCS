// Tipos do módulo nativo `expo-file-system` para o typecheck do console/portal.
//
// O dashboard web não instala os pacotes nativos do Expo: o Vite resolve
// `utils/photoToBase64.web.ts` (fetch + FileReader) no lugar da variante
// nativa, e `expo-file-system` nunca entra no bundle. Mas o typecheck do
// dashboard percorre `utils/` compartilhado com o app, que importa o módulo
// nativo — então os tipos precisam existir.
//
// estes tipos NÃO são um stub solto: eles espelham a API pública real do
// `expo-file-system` (v58). Se a API do pacote mudar, este arquivo precisa
// mudar junto — a alternativa (tipos `any`) esconderia erros de verdade,
// inclusive o bug de `File` caindo no `interface File` do `lib.dom`.
//
// O CI do dashboard instala apenas `dashboard/package-lock.json`, que não
// inclui os pacotes do Expo — daí a necessidade deste arquivo.
declare module 'expo-file-system' {
  /** Diretório no sistema de arquivos (ex.: `Paths.cache`). */
  export class Directory {
    constructor(...uris: string[]);
    readonly uri: string;
    exists: boolean;
    delete(): void;
    create(options?: { idempotent?: boolean; intermediates?: boolean }): void;
    list(): Directory[];
  }

  export class File {
    constructor(...uris: (string | File | Directory)[]);
    readonly uri: string;
    readonly name: string;
    readonly size: number;
    readonly extension: string;
    readonly parentDirectory: Directory;
    exists: boolean;
    base64(): Promise<string>;
    bytes(): Promise<Uint8Array>;
    text(): Promise<string>;
    arrayBuffer(): Promise<ArrayBuffer>;
    delete(): void;
    // SDK 58: `write` passou a ser assíncrono; `writeSync` é a variante
    // síncrona. O app usa `await file.write(...)`.
    write(content: string | Uint8Array | ArrayBuffer, options?: { encoding?: 'utf8' | 'base64' }): Promise<void>;
    writeSync(content: string | Uint8Array | ArrayBuffer, options?: { encoding?: 'utf8' | 'base64' }): void;
    digest(algorithm: 'MD5' | 'SHA-1' | 'SHA-256' | 'SHA-512'): Promise<string>;
    info(options?: { size?: boolean; creationTime?: boolean; modificationTime?: boolean }): {
      size?: number;
      creationTime?: Date;
      modificationTime?: Date;
    };
    static downloadFileAsync(
      url: string,
      destination: Directory | File,
      options?: { idempotent?: boolean },
    ): Promise<File>;
  }

  export const Paths: {
    readonly cache: Directory;
    readonly document: Directory;
    readonly bundle: Directory;
  };
}
