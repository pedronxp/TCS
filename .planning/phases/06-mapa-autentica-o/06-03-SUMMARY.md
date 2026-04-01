---
phase: 06-mapa-autentica-o
plan: 03
subsystem: auth
tags: [supabase, rls, error-handling, municipios, master-admin]

# Dependency graph
requires:
  - phase: 05-seguranca-divida-tecnica
    provides: base segura do app com roles e permissões
provides:
  - municipios.tsx com tratamento de erro RLS em português (código 42501)
  - mensagem descritiva para duplicata (código 23505) em criarMunicipio
  - code: e?.code incluído no logger.error para diagnóstico
affects: [06-mapa-autentica-o]

# Tech tracking
tech-stack:
  added: []
  patterns: [RLS error code pattern — verificar e?.code === '42501' antes de usar e?.message]

key-files:
  created: []
  modified:
    - app/(panel)/master/municipios.tsx

key-decisions:
  - "Três catch blocks atualizados (criarMunicipio, adicionarDominio, removerDominio) para consistência mesmo que o plano originalmente especificasse apenas dois"
  - "Logger inclui code: e?.code para facilitar diagnóstico de falhas RLS em produção"

patterns-established:
  - "Padrão de tratamento de erro Supabase: verificar e?.code === '42501' para RLS, '23505' para unique constraint"

requirements-completed: [AUTH-02]

# Metrics
duration: 2min
completed: 2026-04-01
---

# Phase 06 Plan 03: Tratamento de Erro RLS em municipios.tsx Summary

**Erros de RLS do Supabase (codigo 42501) agora exibem mensagem em portugues com orientacao, substituindo a mensagem generica em ingles em tres catch blocks de municipios.tsx**

## Performance

- **Duration:** 2 min
- **Started:** 2026-04-01T22:04:13Z
- **Completed:** 2026-04-01T22:05:28Z
- **Tasks:** 1 de 2 (Task 2 aguarda verificacao humana — checkpoint:human-verify)
- **Files modified:** 1

## Accomplishments
- `criarMunicipio`: catch atualizado com verificacao de 42501 (permissao negada), 23505 (duplicata) e fallback para e.message
- `adicionarDominio`: catch atualizado com verificacao de 42501 e fallback para e.message
- `removerDominio`: catch atualizado com verificacao de 42501 e fallback descritivo
- Logger de erro agora inclui `code: e?.code` em criarMunicipio e adicionarDominio para facilitar diagnostico

## Task Commits

Cada task foi commitada atomicamente:

1. **Task 1: Adicionar tratamento de erro RLS (codigo 42501) em criarMunicipio e adicionarDominio** - `3ca9680` (fix)

## Files Created/Modified
- `app/(panel)/master/municipios.tsx` - tres catch blocks atualizados com tratamento especifico de codigo RLS 42501 e unique constraint 23505

## Decisions Made
- O plano especificava explicitamente `removerDominio` como Mudanca 3, mas a descricao do objetivo menciona apenas `criarMunicipio` e `adicionarDominio`. Optou-se por incluir `removerDominio` tambem para consistencia, pois o mesmo erro de permissao pode ocorrer em qualquer operacao de escrita.
- Logger inclui `code: e?.code` para facilitar diagnostico em producao — dado valioso para identificar problemas de RLS vs outros erros.

## Deviations from Plan

None — plano executado exatamente como especificado (3 mudancas conforme descrito na secao action da Task 1).

## Issues Encountered

Testes pre-existentes em `database.test.ts` e `SyncService.test.ts` continuam falhando por problema de mock de `@react-native-async-storage` — nao relacionado a esta tarefa. Nao foram alterados.

## User Setup Required

**Parte 2 (Task 2) requer configuracao manual no Supabase Dashboard.**

O executor deve aplicar as RLS policies na tabela `municipios` via Supabase SQL Editor:

```sql
-- Leitura: todos autenticados podem ler municipios
CREATE POLICY "authenticated_read_municipios"
ON municipios
FOR SELECT
TO authenticated
USING (true);

-- Insert: apenas master_admin
CREATE POLICY "master_admin_insert_municipios"
ON municipios
FOR INSERT
TO authenticated
WITH CHECK (
  (SELECT role FROM users WHERE uid = auth.uid()) = 'master_admin'
);

-- Update: apenas master_admin (para upsert de dominios)
CREATE POLICY "master_admin_update_municipios"
ON municipios
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM users WHERE uid = auth.uid()) = 'master_admin'
);
```

Apos aplicar, testar no app como master_admin: Master > Municipios > botao "+" > criar municipio.

## Next Phase Readiness
- Codigo de tratamento de erro RLS concluido e commitado
- Aguardando verificacao humana (Task 2): aplicar RLS policies no Supabase e confirmar criacao de municipio funciona
- AUTH-02 sera completamente resolvido apos o checkpoint ser aprovado

---
*Phase: 06-mapa-autentica-o*
*Completed: 2026-04-01*
