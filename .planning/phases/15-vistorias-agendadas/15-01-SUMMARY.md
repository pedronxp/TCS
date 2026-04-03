---
plan: 15-01
phase: 15-vistorias-agendadas
status: complete
completed: 2026-04-03
executor: agent
---

## One-liner

Migration SQLite v6 com tabela `agendamentos`, tipos TypeScript `AgendamentoLocal` e SQL de criação da tabela no Supabase com RLS.

## What was built

- `utils/database.ts`: DB_VERSION bumped de 5 para 6; migration v6 cria tabela `agendamentos` com 15 colunas e 3 índices (municipio, agente_uid, status)
- `types/agendamento.ts`: interface `AgendamentoLocal` com campos opcionais tipados, status como union `'pendente' | 'concluido' | 'cancelado'`
- CRUD adicionado ao database.ts: `insertAgendamento`, `getAgendamentosByMunicipio`, `getAgendamentosByAgente`, `getAgendamentoById`, `updateAgendamentoStatus`, `countAgendamentosPendentes`, `countAgendamentosPendentesAgente`, `getAgendamentosNaoSincronizados`, `markAgendamentoSincronizado`
- `supabase/migrations/20260403_agendamentos.sql`: DDL completo com RLS — agentes veem só seu município, admins/supervisors gerenciam tudo
