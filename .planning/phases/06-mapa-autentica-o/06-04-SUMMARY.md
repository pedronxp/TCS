---
phase: 06-mapa-autentica-o
plan: "04"
subsystem: auth
tags: [supabase, postgresql, rpc, invite-token, register]

# Dependency graph
requires:
  - phase: 06-mapa-autentica-o-02
    provides: "register.tsx corrigido para chamar supabase.rpc('validate_invite_token')"
provides:
  - "Função PostgreSQL validate_invite_token criada no Supabase com SECURITY DEFINER"
  - "Fluxo de registro de novos agentes com token de convite funcional end-to-end"
  - "RLS policy para INSERT na tabela users durante signup"
affects: [auth, onboarding, register]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Função SQL SECURITY DEFINER com GRANT EXECUTE para anon e authenticated"
    - "Token comparado por campo 'codigo' (texto), não por id (UUID)"

key-files:
  created: []
  modified:
    - "app/(auth)/register.tsx"

key-decisions:
  - "Função recriada sem campo t.id (não existe na tabela) — retorna codigo, municipio, role, criadoPor, valido, motivo"
  - "codigoNorm em register.tsx preserva hífens (.replace(/\\s/g, '')) — hífens fazem parte do formato do código XXXX-XXXX-XXXX"
  - "RLS policy para INSERT em users criada no Supabase para permitir signup com confirmação de email desabilitada"

patterns-established:
  - "validate_invite_token: WHERE t.codigo = p_codigo AND t.usado = false com LIMIT 1"

requirements-completed: [AUTH-01]

# Metrics
duration: 60min
completed: "2026-04-02"
---

# Phase 06 Plan 04: Criar função validate_invite_token no Supabase Summary

**Função PostgreSQL validate_invite_token criada com SECURITY DEFINER, desbloqueando o registro de novos agentes via token de convite end-to-end**

## Performance

- **Duration:** ~60 min (inclui iterações no SQL Editor e verificação no app)
- **Started:** 2026-04-02T00:00:00Z
- **Completed:** 2026-04-02T01:00:00Z
- **Tasks:** 2 (ambas checkpoint humano)
- **Files modified:** 1 (register.tsx)

## Accomplishments

- Função PostgreSQL `validate_invite_token(p_codigo TEXT)` criada no Supabase SQL Editor com SECURITY DEFINER
- GRANT EXECUTE concedido para roles `anon` e `authenticated`, permitindo chamada via RPC
- Bug corrigido em register.tsx: `codigoNorm` estava removendo hífens com `.replace(/[\s-]/g, '')` — corrigido para `.replace(/\s/g, '')` para preservar o formato XXXX-XXXX-XXXX
- RLS policy para INSERT na tabela `users` criada para suportar signup com confirmação de email desabilitada no Supabase
- Fluxo completo de registro com token válido verificado e aprovado pelo usuário

## Task Commits

Ambas as tarefas foram do tipo checkpoint:human-action e checkpoint:human-verify (ação manual no Supabase + verificação no app). O único commit de código associado a este plano é:

1. **Task 1 (desvio — bug fix register.tsx)** - `f6590c1` (fix: preservar hífens no código do token ao chamar RPC validate_invite_token)

## Files Created/Modified

- `app/(auth)/register.tsx` — Corrigido `.replace(/[\s-]/g, '')` para `.replace(/\s/g, '')` em `codigoNorm`, preservando hífens no código antes do RPC

## Decisions Made

- Função recriada sem o campo `t.id` (que não existe na tabela `invite_tokens`) — a versão final retorna `codigo, municipio, role, criadoPor, valido, motivo`
- Coluna `expiraEm` já era `TIMESTAMPTZ` no banco — o `ALTER TABLE` preventivo do plano não foi necessário
- RLS policy para INSERT em `users` foi necessária pois o Supabase estava configurado sem confirmação de email, e a ausência da policy bloqueava o signup

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Hífens removidos incorretamente antes do RPC**
- **Found during:** Task 1 (aplicação da função SQL e testes iniciais de registro)
- **Issue:** `codigoNorm` em register.tsx usava `.replace(/[\s-]/g, '')`, removendo hífens que fazem parte do formato do código (`XXXX-XXXX-XXXX`). O banco compara `t.codigo = p_codigo` e o código armazenado inclui hífens — a remoção causava mismatch e token inválido mesmo com função criada
- **Fix:** Alterado para `.replace(/\s/g, '')` — remove apenas espaços, preserva hífens
- **Files modified:** `app/(auth)/register.tsx`
- **Verification:** Registro com token recém-criado concluiu sem erro após a correção
- **Committed in:** `f6590c1`

**2. [Rule 1 - Bug] Função original do plano referenciava campo t.id inexistente**
- **Found during:** Task 1 (execução do SQL Bloco 2 no Supabase)
- **Issue:** O SQL do plano incluía `t.id` no SELECT, mas a tabela `invite_tokens` não possui esse campo, causando erro de coluna inexistente ao criar a função
- **Fix:** Função recriada sem `t.id`, adicionando `criadoPor` no lugar (campo que existe na tabela)
- **Files modified:** Supabase (SQL Editor — sem arquivo local)
- **Verification:** `SELECT routine_name FROM information_schema.routines WHERE routine_name = 'validate_invite_token'` retornou uma linha
- **Committed in:** N/A (ação no Supabase Dashboard)

**3. [Rule 2 - Missing Critical] RLS policy para INSERT em users**
- **Found during:** Task 2 (verificação do fluxo de registro no app)
- **Issue:** Com confirmação de email desabilitada no Supabase, o signup tentava fazer INSERT direto na tabela `users`, mas a ausência de policy RLS bloqueava a operação com erro de permissão
- **Fix:** Policy INSERT criada no Supabase Dashboard para permitir insert durante signup
- **Files modified:** Supabase (RLS policies — sem arquivo local)
- **Verification:** Fluxo de registro concluiu sem erro após criação da policy
- **Committed in:** N/A (ação no Supabase Dashboard)

---

**Total deviations:** 3 auto-fixed (2 bugs, 1 missing critical)
**Impact on plan:** Todos os desvios eram necessários para o funcionamento correto. Nenhum scope creep.

## Issues Encountered

- A função SQL do plano continha `t.id` que não existe na tabela — necessário recriar sem esse campo
- A policy RLS para INSERT em `users` não estava documentada como requisito, mas era bloqueante para o signup

## User Setup Required

None - toda a configuração foi realizada diretamente no Supabase Dashboard durante a execução.

## Next Phase Readiness

- AUTH-01 fechado: fluxo de registro com token de convite funcional end-to-end
- Fase 06 agora tem todos os gaps fechados (06-04 AUTH-01 e 06-05 ConnectivityBanner)
- App pronto para validação UAT final

## Self-Check: PASSED

- `app/(auth)/register.tsx` modificado e commitado em `f6590c1`
- Commits verificados: `f6590c1` existe no log
- SUMMARY.md criado em `.planning/phases/06-mapa-autentica-o/06-04-SUMMARY.md`

---
*Phase: 06-mapa-autentica-o*
*Completed: 2026-04-02*
