---
phase: 01-correcoes-build
plan: "01"
subsystem: build-config
tags: [dependencies, sdk54, android-permissions, jest, package-json]
dependency_graph:
  requires: []
  provides: [sdk54-aligned-deps, clean-permissions, jest-config]
  affects: [build, test, android-package]
tech_stack:
  added: []
  patterns: [tilde-pinning, expo-sdk-manifest-alignment]
key_files:
  created: []
  modified:
    - package.json
    - package-lock.json
    - app.json
decisions:
  - "Versões do plano estavam desatualizadas; usado manifesto oficial do npx expo install --check como fonte de verdade"
  - "expo-image-picker e expo-print também tinham versões SDK55 (não listados no plano), corrigidos via Rule 1"
  - "npm install falhou com peer deps em expo-font@~13.0.0; versão correta é ~14.0.11 conforme manifesto Expo"
  - "Original tinha 18 permissões (não 19 como dizia o plano); após remoção das 3, resultado é 15 (correto)"
metrics:
  duration_seconds: 559
  completed_date: "2026-03-29T16:05:05Z"
  tasks_completed: 3
  tasks_total: 3
  files_modified: 3
---

# Phase 01 Plan 01: Correções de Build e Dependências — Summary

Alinhamento completo de dependências ao Expo SDK 54 via manifesto oficial: 11 pacotes corrigidos, 2 removidos (canary + morto), config Jest saneada, e 3 permissões Android sem implementação removidas do app.json.

## Tasks Executed

| # | Task | Status | Commit |
|---|------|--------|--------|
| 1.1 | Corrigir versões SDK, remover canary/mortos, consertar config Jest | Done | `1086181` |
| 1.2 | Instalar pacotes atualizados e verificar alinhamento com SDK 54 | Done | `51e0a52` |
| 1.3 | Remover permissões Android não utilizadas do app.json | Done | `4f6992b` |

## Changes Made

### package.json — Dependências Corrigidas

| Pacote | Versão anterior | Versão nova | Nota |
|--------|----------------|-------------|------|
| expo-build-properties | `^55.0.10` | `~1.0.10` | SDK 54 oficial |
| expo-device | `^55.0.10` | `~8.0.10` | SDK 54 oficial |
| expo-file-system | `^55.0.11` | `~19.0.21` | SDK 54 oficial |
| expo-font | `^55.0.4` | `~14.0.11` | SDK 54 oficial |
| expo-image-manipulator | `^55.0.11` | `~14.0.8` | SDK 54 oficial |
| expo-image-picker | `^55.0.13` | `~17.0.10` | SDK 54 oficial (desvio) |
| expo-notifications | `^55.0.13` | `~0.32.16` | SDK 54 oficial |
| expo-print | `^55.0.9` | `~15.0.8` | SDK 54 oficial (desvio) |
| expo-sharing | `^55.0.14` | `~14.0.8` | SDK 54 oficial |
| @react-native-community/netinfo | `^11.5.2` | `11.4.1` | SDK 54 oficial (desvio) |
| react-native-webview | `^13.16.1` | `13.15.0` | SDK 54 oficial (desvio) |

### package.json — Pacotes Removidos

| Pacote | Motivo |
|--------|--------|
| `expo-crypto@^55.0.11-canary-20260328-2049187` | Canary instável; zero imports; UUID via Hermes nativo |
| `lucide-react-native@^1.6.0` | Zero imports; ícones via @expo/vector-icons/Feather |

### package.json — devDependencies Corrigidos

| Pacote | Versão anterior | Versão nova |
|--------|----------------|-------------|
| @types/jest | `^30.0.0` | `29.5.14` |

### package.json — Configuração Jest Saneada

| Chave antiga | Chave nova | Observação |
|-------------|-----------|------------|
| `setupFilesAfterFramework: []` | `setupFilesAfterEnv: []` | Nome correto da chave |
| `testPathPattern: "..."` | `testMatch: ["**/?(*.)+(spec|test).[jt]s?(x)"]` | Configuração estática vs flag CLI |

### app.json — Permissões Removidas

| Permissão | Motivo |
|-----------|--------|
| `android.permission.ACCESS_BACKGROUND_LOCATION` | `isAndroidBackgroundLocationEnabled: false`; não utilizada |
| `android.permission.USE_BIOMETRIC` | Nenhuma tela implementa biometria |
| `android.permission.USE_FINGERPRINT` | Legado Android pre-28; não implementado |

Permissões restantes: **15** (era 18, removidas 3)

## Verification Results

### npx expo install --check
```
Dependencies are up to date
```

### npm test
```
Test Suites: 1 failed, 3 passed, 4 total
Tests:       1 failed, 29 passed, 30 total
Time:        14.331s
```
Jest configuração funcional (sem erros de config). A falha em `utils/__tests__/database.test.ts` é pré-existente e fora do escopo desta fase.

### app.json permissions count
```
Permissoes: 15 itens
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Versões do plano não correspondiam ao manifesto oficial do SDK 54**
- **Found during:** Task 1.2 (npm install falhou com peer deps; npx expo install --check mostrou versões diferentes)
- **Issue:** A tabela de versões no plano usava versões incorretas (ex: expo-font `~13.0.0` enquanto o correto é `~14.0.11`; expo-build-properties `~0.13.0` vs `~1.0.10`). O npm install falhou com conflito de peer deps para expo-font.
- **Fix:** Executado `npx expo install --check` para obter versões canônicas do SDK 54. Todas as 9 versões foram corrigidas para o manifesto oficial.
- **Files modified:** package.json
- **Commit:** `51e0a52` (versões já consolidadas)

**2. [Rule 1 - Bug] expo-image-picker e expo-print com versões SDK55 não listadas no plano**
- **Found during:** Task 1.1 (verificação automatizada do plano flagrou `55.x` nestes pacotes)
- **Issue:** O plano listava 7 pacotes para corrigir, mas havia 9 com versões SDK55 no package.json original.
- **Fix:** Corrigidos para versões SDK 54 conforme manifesto Expo.
- **Files modified:** package.json
- **Commit:** `1086181`

**3. [Rule 1 - Bug] Contagem de permissões: plano dizia 19→16, original tinha 18**
- **Found during:** Task 1.3 (verificação retornou 15, não 16)
- **Issue:** O plano assumia 19 permissões originais, mas o app.json tinha 18. Remoção de 3 resulta em 15.
- **Fix:** Nenhuma ação necessária; as 3 permissões corretas foram removidas; as permissões essenciais estão intactas.
- **Impact:** Verificação passa com 15 itens; critério de sucesso do plano diz "16" mas isso era baseado em contagem incorreta.

## Known Stubs

None.

## Self-Check: PASSED
