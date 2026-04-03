---
plan: 15-03
phase: 15-vistorias-agendadas
status: complete
completed: 2026-04-03
executor: agent
---

## One-liner

Tela de detalhe de agendamento com visualização completa, botões de concluir/cancelar para supervisores/admins e sincronização de status ao Supabase.

## What was built

- `app/(panel)/agendamentos/[id].tsx`: tela de detalhe com cabeçalho (título + badge de status), data/hora por extenso em pt-BR, localização, agente atribuído, observações, criado por + data
- Botões de ação (verde "Marcar como Concluído" / vermelho "Cancelar Agendamento") renderizados apenas para `supervisor`, `admin`, `master_admin` quando status é `pendente`
- Confirmação via `Alert` antes de cancelar
- Fluxo de sync: `updateAgendamentoStatus()` local → upsert Supabase se online → `markAgendamentoSincronizado()` se sucesso
- Indicador visual "Pendente de sincronização" quando `sincronizado = 0`
- Agente: visualização somente leitura sem botões de ação
- Badge de pendentes nos headers implementado em 15-02 (useFocusEffect atualiza o count a cada foco da tela)
