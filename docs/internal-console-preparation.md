# Preparação do console interno

Este documento fecha as decisões preparatórias da mudança
`reformular-dashboard-interno-donos-programadores`.

## Compatibilidade com a fundação comercial

A mudança `criar-planos-assinatura-e-gestao-municipal` já está integrada à
`main` pelas migrations `20260716141609_subscription_platform.sql`,
`20260716142121_fix_subscription_platform_remote_validation.sql` e
`20260716154744_approve_commercial_plan_defaults.sql`. O console interno deve
reutilizar, sem duplicar:

| Domínio | Contratos reutilizados |
| --- | --- |
| Identidade legada | `owner_admins` somente como origem da migração para `internal_staff` |
| Clientes municipais | `organizations`, `organization_members`, `organization_onboarding` |
| Planos e consumo | `plans`, `plan_versions`, `features`, `plan_features`, `plan_limits`, `usage_counters`, `usage_events` |
| Assinaturas | `subscriptions`, `subscription_settings`, `subscription_audit_events`, `update_plan_commercial_configuration` |
| Sessões | `active_sessions`, `register_active_session`, `heartbeat_active_session`, `end_active_session` |
| Suporte | `support_tickets`, `support_ticket_events`, `support_sla_policies`, `open_support_ticket` |
| Escopo operacional | `organization_id` já presente em `users`, `vistorias` e `agendamentos` |

As páginas `PlansPage`, `OrganizationsPage`, `SubscriptionsPage`,
`SessionsPage`, `SupportPage` e `CommercialMetricsPage` serão migradas para os
novos hooks e componentes, preservando seus contratos de dados. O helper
`private.is_owner_admin` permanece apenas durante a transição; novas operações
internas usam `private.has_internal_permission`.

## Matriz de permissões

Princípios: negar por padrão; validar no servidor; exigir `aal2` e confirmação
para ações de alto risco; não usar papel municipal nem metadata editável.

| Ação | Owner | Developer | Garantia adicional |
| --- | :---: | :---: | --- |
| Ver dashboard do próprio papel | ✓ | ✓ | Staff ativo |
| Buscar clientes e ver saúde sanitizada | ✓ | ✓ | Campos mínimos para developer |
| Ver dados pessoais/operacionais detalhados | ✓ | Condicional | Developer exige chamado ativo, motivo e auditoria |
| Criar/editar cliente e implantação | ✓ | — | `aal2`, confirmação e auditoria |
| Editar planos, preço, assinatura e overrides | ✓ | Somente leitura | `aal2`, justificativa, idempotência e auditoria |
| Operar suporte e sessões | ✓ | ✓ | Encerrar sessão exige `aal2`, motivo e confirmação |
| Administrar staff interno | ✓ | — | `aal2` e auditoria antes/depois |
| Ver versões, builds e eventos técnicos | ✓ | ✓ | Metadados sanitizados |
| Iniciar build preview/development | ✓ | ✓ | Confirmação e auditoria |
| Solicitar build/publicação de produção | Aprova | Solicita | Separação de funções; execução só após aprovação do owner em `aal2` |
| Editar/publicar formulários e regras de risco | Aprova | Prepara/solicita | Simulação, versão, rollback e `aal2` na publicação |

Os papéis `support` e `auditor` ficam reservados no modelo, sem acesso no
rollout inicial. A telemetria inicial usa `technical_events` persistida no
Supabase; integrações externas futuras alimentam o mesmo contrato sanitizado.

## Mapa de rotas

| Rota atual | Destino | Tratamento |
| --- | --- | --- |
| `/` | `/` | Substituir por dashboard executivo ou técnico conforme papel |
| `/organizacoes` | `/clientes` | Substituir pela lista unificada de clientes |
| `/assinaturas` | `/clientes/:id/assinatura` | Mover para o cliente; manter redirect de compatibilidade |
| `/sessoes` | `/sessoes` e `/clientes/:id/sessoes` | Manter visão global autorizada e adicionar contexto do cliente |
| `/suporte` | `/suporte` e `/clientes/:id/chamados` | Manter fila global e adicionar contexto do cliente |
| `/planos` | `/planos` | Manter; mutation só para owner |
| `/indicadores-comerciais` | `/` | Substituir pelo dashboard executivo |
| `/ocorrencias` | `/clientes/:id/vistorias` | Exigir cliente; redirect para `/clientes` |
| `/agendamentos` | `/clientes/:id/agendamentos` | Exigir cliente; redirect para `/clientes` |
| `/mapa` | `/clientes/:id/mapa` | Exigir cliente; redirect para `/clientes` |
| `/usuarios` | `/clientes/:id/usuarios` | Mover usuários municipais para o cliente |
| `/laudos` | `/clientes/:id/laudos` | Exigir cliente; redirect para `/clientes` |
| `/relatorios` | `/clientes/:id/relatorios` | Exigir cliente; redirect para `/clientes` |
| `/builds` | `/desenvolvimento/builds` | Substituir por operação protegida por papel e ambiente |
| `/configuracoes` | `/governanca/configuracoes` | Mover para Governança |
| `/arquivamento` | `/governanca/arquivamento` | Mover para Governança |

Novas rotas: `/clientes/:id`, `/staff`, `/auditoria`, `/versoes`,
`/desenvolvimento/formularios`, `/desenvolvimento/regras-risco`,
`/desenvolvimento/sincronizacao`, `/desenvolvimento/armazenamento` e
`/desenvolvimento/logs`.

## Ativação e rollback

O console interno é o shell único. O gate temporário e as rotas globais de
compatibilidade foram removidos depois da validação transacional dos papéis
`owner` e `developer`.

Em caso de regressão, reverta o deploy do dashboard para o artefato anterior.
Mantenha `internal_staff`, auditoria, eventos técnicos e as políticas de RLS;
não restaure a autorização municipal ampla. Registre motivo, responsável,
horário e resultado do rollback.
