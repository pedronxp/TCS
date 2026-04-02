---
status: diagnosed
phase: 06-mapa-autentica-o
source: 06-01-SUMMARY.md, 06-02-SUMMARY.md, 06-03-SUMMARY.md
started: 2026-04-02T00:00:00Z
updated: 2026-04-02T00:05:00Z
---

## Current Test
<!-- OVERWRITE each test - shows where we are -->

[testing complete]

## Tests

### 1. Mapa carrega em Android físico
expected: Abrir a tela de Mapa em dispositivo Android físico. O mapa Leaflet deve aparecer sem tela branca. Retry loop de 15 tentativas (1500ms) garante que o mapa inicializa mesmo em devices lentos.
result: pass

### 2. Mapa carrega em iOS físico
expected: Abrir a tela de Mapa em dispositivo iOS físico. O mapa deve aparecer corretamente após o onLoadEnd nativo disparar. O injectJavaScript pós-onLoadEnd chama invalidateSize e o mapa renderiza sem distorção.
result: pass

### 3. Falha de CDN exibe mensagem de erro
expected: Se o CDN do Leaflet falhar (sem internet ou CDN indisponível), o app deve mostrar uma mensagem de erro visível. Não pode ficar em loading infinito — o estado de loading deve ser resolvido mesmo em falha.
result: issue
reported: "apareceu barra laranja com seguinte mensagem 'modo offline - Dados sincronizados ao reconectar' melhorar jeito que ela fica no design do app, tem que arrumar isso. mapa carrega normalmente"
severity: cosmetic

### 4. Registro com token recém-criado funciona
expected: Gerar um token de convite e imediatamente registrar com ele. O registro deve ser aceito sem rejeição por fuso horário. (Requer função validate_invite_token aplicada no Supabase.)
result: issue
reported: "Da erro 'Token inválido ou já utilizado.' mesmo eu acabando de criar o token agora."
severity: major

### 5. Registro com token expirado exibe erro correto
expected: Tentar registrar com um token expirado. O app deve exibir mensagem de erro clara indicando que o token expirou — não uma mensagem genérica.
result: pass

### 6. Registro com token inválido exibe erro correto
expected: Tentar registrar com um token inexistente/inválido. O app deve exibir mensagem de erro indicando token inválido.
result: pass

### 7. Erro de permissão RLS em Municípios exibe mensagem em português
expected: Acessar Master > Municípios como usuário sem permissão de master_admin e tentar criar município. O erro deve aparecer em português com orientação — não a mensagem genérica em inglês do Supabase. (Requer RLS policies aplicadas no Supabase.)
result: skipped
reason: Só possui conta master_admin — não tem como simular usuário sem permissão

### 8. Município duplicado exibe mensagem descritiva
expected: Tentar criar um município com nome já existente como master_admin. O app deve exibir mensagem clara indicando que o município já existe (código 23505), não uma mensagem genérica.
result: pass

### 9. master_admin cria município com sucesso
expected: Logar como master_admin, acessar Master > Municípios, clicar em "+" e criar novo município. O município deve ser salvo e aparecer na lista sem erros. (Requer RLS policies aplicadas no Supabase.)
result: pass

## Summary

total: 9
passed: 6
issues: 2
pending: 0
skipped: 1
blocked: 0
skipped: 0
blocked: 0

## Gaps

- truth: "Registro com token recém-criado é aceito sem erro"
  status: failed
  reason: "User reported: Da erro 'Token inválido ou já utilizado.' mesmo eu acabando de criar o token agora."
  severity: major
  test: 4
  root_cause: "Função PostgreSQL validate_invite_token nunca foi criada no Supabase. Task 3 do plano 06-02 era checkpoint humano pendente. Quando o app chama supabase.rpc('validate_invite_token'), o Supabase retorna erro 'function does not exist', que register.tsx linha 75 trata como 'Token inválido ou já utilizado.' mascarando o erro real."
  artifacts:
    - path: "app/(auth)/register.tsx"
      issue: "Linha 75 mascara erro de RPC (function does not exist) como 'Token inválido ou já utilizado'"
    - path: ".planning/phases/06-mapa-autentica-o/06-02-PLAN.md"
      issue: "SQL da função validate_invite_token está documentado na Task 3 mas nunca foi aplicado no Supabase"
  missing:
    - "Aplicar SQL da função validate_invite_token no Supabase SQL Editor (documentado em 06-02-PLAN.md Task 3)"
  debug_session: ".planning/debug/token-invalido-registro.md"

- truth: "Banner offline integrado visualmente ao design do app"
  status: failed
  reason: "User reported: barra laranja com texto 'modo offline - Dados sincronizados ao reconectar' precisa melhorar no design"
  severity: cosmetic
  test: 3
  root_cause: "components/ConnectivityBanner.tsx usa cores hardcoded (#F59E0B, #10B981) ignorando os tokens do design system em constants/Colors.ts. O formato de barra full-width tampa o header das telas e não tem suporte a dark mode."
  artifacts:
    - path: "components/ConnectivityBanner.tsx"
      issue: "Cores hardcoded, sem tokens do design system, sem dark mode, formato de barra full-width genérica"
    - path: "constants/Colors.ts"
      issue: "Tokens warning/warningLight/warningText/success já existem mas não são usados pelo banner"
  missing:
    - "Substituir barra full-width por pill/toast flutuante centralizado abaixo do safe area"
    - "Usar tokens Colors.warning/warningLight/warningText e Colors.success/successLight/successText"
    - "Adicionar useColorScheme() para dark mode automático"
  debug_session: ".planning/debug/banner-offline-design.md"
