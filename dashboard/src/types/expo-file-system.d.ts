// Shim de tipos para o módulo nativo usado apenas pelo app Expo.
// Na web, o Vite resolve utils/photoToBase64.web.ts, então 'expo-file-system'
// nunca entra no bundle — este arquivo existe apenas para o typecheck.
declare module 'expo-file-system' {
  export class File {
    constructor(...args: any[]);
    exists: boolean;
    base64(): Promise<string>;
    delete(): void;
    static downloadFileAsync(url: string, to: File, options?: { idempotent?: boolean }): Promise<File>;
  }
  export const Paths: { cache: any };
}
