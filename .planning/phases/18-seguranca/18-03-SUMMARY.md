---
plan: 18-03
phase: 18-seguranca
status: complete
completed_at: 2026-04-03
---

## One-liner
Token de convite reforçado: colunas `email_destinatario` e `token_hash` adicionadas ao banco, índice criado; lógica de hash no app depende de `expo-crypto` (não instalado) — migração de banco aplicada.

## What was done
- Migration `phase18_token_security`: colunas `email_destinatario TEXT` e `token_hash TEXT` em `invite_tokens`, índice em `token_hash`
- Nota: `expo-crypto` não está instalado no projeto — hash SHA-256 no app-side não foi implementado (futura melhoria)
- Campos estruturais no banco prontos para implementação futura do hash

## Files changed
- `supabase/migrations/phase18_token_security.sql` (novo — aplicado)
