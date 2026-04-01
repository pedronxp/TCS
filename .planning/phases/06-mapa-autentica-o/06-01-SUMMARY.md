---
phase: 06-mapa-autentica-o
plan: 01
subsystem: ui
tags: [leaflet, webview, react-native-webview, android, ios, mapa]

# Dependency graph
requires:
  - phase: 05-seguranca-divida-tecnica
    provides: mapas.tsx WebView base com Leaflet/CDN scripts já funcionando
provides:
  - Retry loop robusto (15x / 1500ms) para initMap em Android físico
  - CDN onerror notifica React Native via postMessage com type loadError
  - handleLoadEnd com injectJavaScript após 500ms do onLoadEnd nativo
  - handleMessage resolve estado de loading em mapReady e loadError
affects:
  - 06-02-autenticacao
  - qualquer fase que modifique app/(panel)/mapas.tsx

# Tech tracking
tech-stack:
  added: []
  patterns:
    - injectJavaScript para operações pós-layout nativo (mais confiável que timers no HTML)
    - postMessage bidirecional WebView <-> React Native para estado de loading
    - retry counter em JS puro para aguardar layout do WebView no Android

key-files:
  created: []
  modified:
    - app/(panel)/mapas.tsx

key-decisions:
  - "_initRetry counter adicionado antes de function initMap() — var hoisting garante que a declaração está disponível na primeira chamada"
  - "invalidateSize duplo (300ms + 800ms) para cobrir dispositivos Android lentos sem depender apenas do onLoadEnd"
  - "handleLoadEnd usa setTimeout 500ms após onLoadEnd nativo — mais confiável que timers dentro do HTML porque onLoadEnd dispara após layout nativo finalizar"

patterns-established:
  - "injectJavaScript com true; no final — obrigatório para iOS (WebView retorna undefined sem isso)"
  - "postMessage do HTML para RN com JSON.stringify({type:'...', msg:'...'}) — padrão já estabelecido para tap, estendido para loadError/mapReady"

requirements-completed:
  - MAPA-01
  - MAPA-02

# Metrics
duration: 3min
completed: 2026-04-01
---

# Phase 6 Plan 01: Mapa WebView — Retry Robusto e onLoadEnd Summary

**Retry loop de 15 tentativas (1500ms) + postMessage CDN onerror + injectJavaScript via onLoadEnd nativo para corrigir tela branca do mapa Leaflet em Android físico**

## Performance

- **Duration:** 3 min
- **Started:** 2026-04-01T22:04:23Z
- **Completed:** 2026-04-01T22:06:49Z
- **Tasks:** 2/3 completos (Task 3 aguarda verificação manual em dispositivo físico)
- **Files modified:** 1

## Accomplishments
- `_initRetry` counter adicionado com até 15 tentativas x 100ms (1500ms total) antes de mostrar erro
- CDN `s.onerror` agora chama `postMessage` para React Native com `{type:'loadError', msg:'cdn_fail'}` — estado de loading resolvido mesmo em falha de CDN
- `handleLoadEnd` injetado na WebView: chama `map.invalidateSize` após 500ms do evento nativo `onLoadEnd`, que é mais confiável que timers dentro do HTML
- `handleMessage` expandido para processar `mapReady` e `loadError`, resolvendo o estado React `loading`
- `invalidateSize` duplo (300ms + 800ms) dentro do `initMap` para Android físico lento

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Corrigir retry loop do initMap e postMessage no onerror do CDN** - `710d5c3` (feat)
2. **Task 2: Adicionar onLoadEnd na WebView para invalidateSize via injectJavaScript** - `760e32e` (feat)
3. **Task 3: Verificação manual do mapa em dispositivo físico** - aguardando checkpoint human-verify

## Files Created/Modified
- `app/(panel)/mapas.tsx` - Retry loop robusto, CDN onerror postMessage, handleLoadEnd, handleMessage expandido

## Decisions Made
- `_initRetry` declarado como `var` antes de `function initMap()` — var hoisting permitiria colocar depois também, mas posicionado antes para clareza
- `handleLoadEnd` implementado no componente React (não no HTML) para aproveitar referência nativa `webviewRef.current` — acesso direto ao método `injectJavaScript`
- `invalidateSize` duplo mantido (300ms para maioria dos devices, 800ms para devices Android mais lentos)

## Deviations from Plan

### Auto-fixed Issues

Nenhuma. Todas as mudanças foram exatamente conforme especificado no plano.

---

**Total deviations:** 0 — plano executado exatamente como escrito.

## Issues Encountered
- Testes pré-existentes falham (5 de 30) em `SyncService.test.ts` e `database.test.ts` por mock de `@react-native-async-storage/async-storage`. Isso é pré-existente e fora do escopo desta task — verificado por `git stash` antes das mudanças. Nenhum teste novo quebrado.

## User Setup Required
Nenhuma configuração externa necessária.

## Next Phase Readiness
- Task 3 (verificação manual) aguarda checkpoint human-verify em dispositivo Android e iOS físicos
- Após aprovação, pronto para fase 06-02 (autenticação)
- Código está em produção no worktree `agent-a7293844`, branch `worktree-agent-a7293844`

---
*Phase: 06-mapa-autentica-o*
*Completed: 2026-04-01*
