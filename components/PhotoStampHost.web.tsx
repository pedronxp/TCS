/**
 * O carimbo usa captura nativa e o fluxo de arquivos do Expo no Android/iOS.
 * Manter a versão web independente evita importar módulos nativos e o
 * rasterizador HTML opcional do view-shot no portal/browser.
 */
export function PhotoStampHost() {
  return null;
}
