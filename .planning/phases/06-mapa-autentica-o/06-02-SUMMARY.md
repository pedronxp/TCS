---
phase: 06-mapa-autentica-o
plan: "02"
subsystem: autenticacao
tags: [auth, token, rpc, bug-fix, timezone]
dependency_graph:
  requires: []
  provides: [validate_invite_token RPC integration, token expiry bug fix]
  affects: [app/(auth)/register.tsx, utils/__tests__/tokenExpiry.test.ts]
tech_stack:
  added: []
  patterns: [server-side validation via Supabase RPC, PostgreSQL now() comparison]
key_files:
  created:
    - utils/__tests__/tokenExpiry.test.ts
  modified:
    - app/(auth)/register.tsx
decisions:
  - Usar RPC server-side (validate_invite_token) para evitar comparação client-side com fuso horário
  - Manter alias tokenData = tokenValidation para compatibilidade com código downstream
metrics:
  duration: "1m 28s"
  completed: "2026-04-01T22:05:37Z"
  tasks_completed: 2
  tasks_total: 3
  files_created: 1
  files_modified: 1
---

# Phase 06 Plan 02: Correção AUTH-01 — Validação de Token via RPC Summary

**One-liner:** Substituição da validação client-side de expiração de token por RPC PostgreSQL server-side, eliminando bug de fuso horário que rejeitava tokens recém-criados.

## O Que Foi Feito

- Criado `utils/__tests__/tokenExpiry.test.ts` com 5 testes unitários cobrindo todos os cenários de resposta do RPC `validate_invite_token`
- Modificado `app/(auth)/register.tsx` para usar `supabase.rpc('validate_invite_token')` em vez de query direta na tabela + comparação `new Date(expiraEm) < new Date()`
- Eliminado o bug de fuso horário (AUTH-01): quando o Supabase armazenava TIMESTAMP sem timezone, o JavaScript interpretava como hora local, causando rejeição falsa de tokens válidos

## Commits

| Task | Descrição | Commit |
|------|-----------|--------|
| 1 | test(06-02): adicionar testes unitários para validação de token via RPC | a86c226 |
| 2 | fix(06-02): substituir validação client-side de token por RPC server-side | 8709a40 |

## Deviations from Plan

None - plano executado exatamente como especificado.

## Checkpoint Pendente

**Task 3 (checkpoint:human-verify)** — aguardando ação humana:

1. Aplicar SQL da função `validate_invite_token` no Supabase Dashboard (SQL Editor)
2. (Opcional) Verificar e converter coluna `expiraEm` para TIMESTAMPTZ
3. Testar fluxo de registro com token recém-criado no app

O SQL completo está em `.planning/phases/06-mapa-autentica-o/06-02-PLAN.md` na Task 3.

## Known Stubs

Nenhum. A função `validate_invite_token` precisa ser criada no Supabase (SQL fornecido na Task 3 do plano), mas o código do app está completamente implementado.

## Self-Check: PASSED

- FOUND: utils/__tests__/tokenExpiry.test.ts
- FOUND: app/(auth)/register.tsx
- FOUND commit: a86c226 (test)
- FOUND commit: 8709a40 (fix)
