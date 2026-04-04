---
plan: 18-01
phase: 18-seguranca
status: complete
completed_at: 2026-04-03
---

## One-liner
Auditoria RLS concluída: política `vistorias_agent_own` (FOR ALL) dividida em SELECT + UPDATE separados, eliminando permissão de DELETE indevida para agentes.

## What was done
- Consultou `pg_policies` via MCP Supabase para mapear políticas existentes
- Identificou gap crítico: `vistorias_agent_own` usava `FOR ALL`, dando DELETE a agentes
- Aplicou migration `phase18_rls_fix_agent_delete`: removeu política antiga, criou `vistorias_agent_select` e `vistorias_agent_update` separadas

## Files changed
- `supabase/migrations/phase18_rls_fix_agent_delete.sql` (novo — aplicado ao Supabase)
