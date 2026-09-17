// Força a inicialização do fetch global do Expo durante o setup do Jest.
// O mock do expo-modules-core no preset do jest-expo é lazy: sem isto, o aviso
// do ExpoModulesCoreJSLogger dispara depois do teardown e o processo sai com
// exit code 1 mesmo com todos os testes passando.
try {
  void globalThis.fetch;
} catch {
  // Ambiente sem fetch global — nada a fazer.
}
