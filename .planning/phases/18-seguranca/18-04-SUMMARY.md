---
plan: 18-04
phase: 18-seguranca
status: complete
completed_at: 2026-04-03
---

## One-liner
Validação e sanitização implementadas: `validationUtils.ts` com helpers reutilizáveis; constraints de comprimento aplicadas no banco; `dados-iniciais.tsx` valida e sanitiza antes de avançar.

## What was done
- `utils/validationUtils.ts`: `sanitizarTexto`, `validarEmail`, `validarCep`, `validarNome`, `validarEndereco`, `validarMunicipio`
- Migration `phase18_input_constraints`: constraints `char_length` em `vistorias` e `users`
- `dados-iniciais.tsx`: usa `validarMunicipio`, `validarNome`, `sanitizarTexto` antes de avançar para próxima tela

## Files changed
- `utils/validationUtils.ts` (novo)
- `supabase/migrations/phase18_input_constraints.sql` (novo — aplicado)
- `app/(panel)/inspecoes/dados-iniciais.tsx` (validação no avancar())
