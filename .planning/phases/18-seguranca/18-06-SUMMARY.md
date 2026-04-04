---
plan: 18-06
phase: 18-seguranca
status: complete
completed_at: 2026-04-03
---

## One-liner
Proteção de sessão implementada sem biometria: `SessionGuardContext` detecta 8h de inatividade via AppState + AsyncStorage; `SessionLockScreen` exibida automaticamente no layout do painel.

## What was done
- `context/SessionGuardContext.tsx`: AppState listener, timestamp em AsyncStorage, `isLocked` state, `unlock()` e `recordActivity()`; timeout 8h
- `components/SessionLockScreen.tsx`: tela de bloqueio com botão "Continuar" (sem biometria — `expo-local-authentication` não instalado)
- `app/(panel)/_layout.tsx`: `SessionGuardProvider` envolvendo todo o painel; `SessionLockScreen` renderizada quando `isLocked=true`

## Files changed
- `context/SessionGuardContext.tsx` (novo)
- `components/SessionLockScreen.tsx` (novo)
- `app/(panel)/_layout.tsx` (SessionGuardProvider + lock screen)
