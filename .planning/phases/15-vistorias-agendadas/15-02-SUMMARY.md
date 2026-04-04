---
plan: 15-02
phase: 15-vistorias-agendadas
status: complete
completed: 2026-04-03
executor: agent
---

## One-liner

Tela de lista de agendamentos com FAB, modal de criação inline e ícone de calendário com badge nos headers de dashboard, admin, supervisor e master.

## What was built

- `app/(panel)/agendamentos/_layout.tsx`: Stack layout sem header nativo
- `app/(panel)/agendamentos/index.tsx`: tela completa com lista de cards (título, data, endereço, badge de status, agente), FAB "+" para admins/supervisors, modal bottom-sheet de criação com campos título/endereço/data/agente/observações; offline-first (SQLite primeiro, upsert Supabase se online)
- Dropdown de agentes carregado do Supabase (`users` onde `role='agent'` e `municipio=profile.municipio`)
- `app/(panel)/dashboard.tsx`: ícone de calendário ao lado do avatar; badge vermelho com contagem de pendentes do agente
- `app/(panel)/admin/index.tsx`: ícone de calendário + badge; headerActions em row com gap
- `app/(panel)/supervisor/index.tsx`: ícone de calendário entre mapa e perfil; badge de pendentes por município
- `app/(panel)/master/index.tsx`: ícone de calendário + badge; headerActions em row
