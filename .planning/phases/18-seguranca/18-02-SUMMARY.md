---
plan: 18-02
phase: 18-seguranca
status: complete
completed_at: 2026-04-03
---

## One-liner
Rate limiting implementado no banco (tabela `rate_limits` + RPC `check_rate_limit`) e no app para PDF (10/h), criação de vistoria (30/dia) via `checkRateLimit()`, e login (5/15min) via AsyncStorage.

## What was done
- Migration `phase18_rate_limits`: tabela `rate_limits` com UPSERT atômico e janela temporal
- `utils/rateLimitUtils.ts`: `checkRateLimit(uid, action)` — chama `supabase.rpc('check_rate_limit')`, fail-open se RPC falhar
- `utils/loginRateLimit.ts`: throttle de login por AsyncStorage — 5 tentativas / janela 15min
- `wizard.tsx` e `resultado.tsx` integrados com `checkRateLimit` antes das ações de alto custo
- `login.tsx` integrado com `getLoginBlockedUntil` / `recordLoginAttempt` / `clearLoginAttempts`

## Files changed
- `supabase/migrations/phase18_rate_limits.sql` (novo — aplicado)
- `utils/rateLimitUtils.ts` (novo)
- `utils/loginRateLimit.ts` (novo)
- `app/(panel)/inspecoes/wizard.tsx` (checkRateLimit criar_vistoria)
- `app/(panel)/inspecoes/resultado.tsx` (checkRateLimit gerar_pdf)
- `app/(auth)/login.tsx` (bloqueio por excesso de tentativas)
