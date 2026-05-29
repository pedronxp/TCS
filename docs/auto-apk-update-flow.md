# Fluxo automatico de atualizacao APK

Este fluxo transforma uma atualizacao aprovada no codigo em um APK publicado e em uma regra remota de atualizacao obrigatoria para o app Android instalado.

## O que ja existe no app

- O app consulta `app_update_config` no Supabase ao abrir.
- Se `mandatory=true`, `apk_url` existir e o `versionCode` instalado for menor que `min_required_version_code`, a tela `ForceUpdateGate` bloqueia o uso.
- O botao `Baixar atualizacao` abre o link do APK.
- O Android exige confirmacao manual do usuario para instalar por cima. O app nao consegue instalar silenciosamente por seguranca do sistema.
- Tokens Expo Push ja sao registrados no campo `users.fcmToken`.

## O que a automacao faz

Workflow: `.github/workflows/auto-apk-release.yml`

Em push para `main` ou execucao manual:

1. Instala dependencias.
2. Incrementa a versao patch e o `android.versionCode`, ou usa os valores informados manualmente.
3. Valida TypeScript.
4. Executa testes.
5. Valida `expo config`.
6. Commita o bump de versao com `chore(release): publish apk vX.Y.Z`.
7. Gera APK via EAS Build.
8. Baixa o APK gerado.
9. Publica o APK no repositorio de releases.
10. Atualiza `app_update_config` no Supabase.
11. Registra o build na tabela `builds`, se existir.
12. Envia push Expo para usuarios com `fcmToken`, se habilitado.

Se build, teste ou publicacao falhar, o Supabase nao e atualizado e os usuarios nao sao bloqueados por uma versao sem APK valido.

## Secrets e variaveis necessarias

GitHub repository secrets:

- `EXPO_TOKEN`: token do EAS/Expo para gerar build.
- `SUPABASE_URL`: URL do projeto Supabase.
- `SUPABASE_SERVICE_KEY`: service role key para atualizar `app_update_config`, registrar build e ler `users.fcmToken`.
- `APK_RELEASE_TOKEN`: token GitHub com permissao de escrever releases no repositorio configurado em `APK_RELEASE_REPO`. Se o repositorio de release for o mesmo do codigo, o `GITHUB_TOKEN` pode bastar.
- `RELEASE_COMMIT_TOKEN`: opcional. Token usado para commitar o bump de versao. Se ausente, usa `GITHUB_TOKEN`.

GitHub repository variables:

- `APK_RELEASE_REPO`: opcional. Padrao: `pedronxp/TCS-apk-releases`.

## Comportamento esperado no celular

1. Usuario esta com `1.3.9` instalada.
2. Uma alteracao e mergeada em `main`.
3. O workflow gera `1.3.10` com `versionCode` maior.
4. Supabase passa a exigir a nova versao.
5. O app instalado consulta o Supabase ao abrir.
6. A tela obrigatoria aparece.
7. Usuario toca em baixar.
8. APK vai para Downloads ou abre pelo navegador.
9. Android pede confirmacao de instalacao.
10. Usuario instala por cima.
11. App abre na nova versao.

## Ponto de seguranca

Para nao quebrar o app funcional:

- Nao publique `mandatory=true` manualmente antes de existir APK valido.
- Nao reutilize o mesmo `versionCode`.
- Nao substitua um APK antigo mantendo o mesmo nome/versao.
- Se precisar testar sem bloquear usuarios, execute o workflow manual com `mandatory=false`.
- Se uma release obrigatoria sair com problema, rode uma nova release com `versionCode` maior e APK corrigido.
