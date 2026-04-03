# 08-02 Summary

status: complete
tasks_completed: 1
key_changes:
  - SyncService.test.ts expandido de 4 para 9 casos
  - Novos casos: deduplicação, foto file://, falha+incremento, backoff 30s, esgotado sem incremento
  - Todos 9 testes passam

---

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Mock de upsert insuficiente para acionar scheduleAutoRetry**
- **Found during:** Caso 4 (backoff)
- **Issue:** A implementação de SyncService tem dois estágios de upsert: batch e individual fallback. O mock configurado com `mockResolvedValueOnce` fazia o batch falhar mas o fallback individual passar — resultando em `sucesso=1, falha=0`, sem acionar `scheduleAutoRetry`.
- **Fix:** Configurado `mockUpsert` com duas chamadas `mockResolvedValueOnce({ error: ... })` consecutivas para garantir que ambos os estágios falhem e `falha=1` seja atingido.
- **Files modified:** `services/__tests__/SyncService.test.ts`
- **Commit:** 47f561f

**2. [Rule 1 - Bug] Flush assíncrono insuficiente para retry timer**
- **Found during:** Caso 4 (backoff)
- **Issue:** `Promise.resolve()` não é suficiente para flush completo da cadeia async dentro do setTimeout callback. `jest.advanceTimersByTime()` dispara o timer mas não aguarda a Promise do callback.
- **Fix:** Substituído por `jest.advanceTimersByTimeAsync()` (Jest 29) + `jest.runAllTimersAsync()` para garantir que toda a cadeia async de `syncPendentes(true)` complete antes do assert.
- **Files modified:** `services/__tests__/SyncService.test.ts`
- **Commit:** 47f561f

## Self-Check: PASSED

Files created/modified:
- services/__tests__/SyncService.test.ts — FOUND

Commits:
- 47f561f — FOUND
