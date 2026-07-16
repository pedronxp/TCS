## Context

O aplicativo atual é Expo/React Native para iOS e Android, usa Supabase Auth e possui `AuthContext` e fluxo de login por e-mail. O repositório também possui um dashboard React/Vite. Não há ainda um modelo central de assinatura, organização municipal, entitlement por recurso, sessão única ou suporte operacional.

A mudança atende dois públicos: usuário individual, cuja conta é o cliente, e prefeitura/Defesa Civil, cuja organização contém vários agentes. O painel web permanecerá interno aos proprietários/desenvolvedores. A autorização não pode depender do município digitado no aparelho; precisa depender de vínculos persistidos e políticas no banco.

## Goals / Non-Goals

**Goals:**

- Criar um catálogo configurável de planos, recursos e limites.
- Isolar dados e permissões por organização municipal.
- Garantir uma conta e uma sessão ativa por pessoa.
- Vincular convites à organização que os emitiu.
- Aplicar limites e recursos no servidor e refletir o estado no app.
- Dar aos proprietários um backoffice para clientes, planos, suporte e auditoria.

**Non-Goals:**

- Definir preço final, provedor de pagamento ou contrato jurídico nesta mudança.
- Criar um portal web operacional para agentes ou prefeituras.
- Permitir que um usuário pertença a várias prefeituras na primeira versão.
- Reescrever os modelos de vistoria existentes.
- Implementar cobrança automática antes da aprovação comercial.

## Decisions

### 1. Organização como fonte de autorização

Adicionar `organizations` e `organization_members`. Dados municipais devem carregar `organization_id`; o acesso deve ser protegido por RLS e funções de servidor. O campo textual de município poderá continuar para exibição, mas não será fonte de autorização.

Alternativas consideradas: confiar no município enviado pelo cliente (rejeitado por permitir adulteração) e usar apenas um campo em `users` (insuficiente para separar vínculo, função, status e auditoria).

### 2. Catálogo de entitlements configurável

Usar `plans`, `plan_features`, `subscriptions` e `usage_counters`. Recursos como `vistoria_arv` e `modo_treinamento` serão permissões; vistorias, convites, agentes e armazenamento serão limites. Os valores ficarão no banco e poderão ser alterados no dashboard.

Alternativa considerada: codificar limites no app (rejeitada porque exige publicação para cada alteração comercial).

### 3. Convite municipal server-side

O convite terá `organization_id`, função, expiração, uso único e auditoria. A validação será feita por RPC protegida ou Edge Function; o cliente não poderá escolher a organização. O token deverá ser aleatório e, preferencialmente, armazenado como hash.

### 4. Sessão única por pessoa

Registrar a sessão do Supabase e metadados mínimos em `active_sessions`, usar heartbeat e expiração por inatividade. A decisão de aceitar um novo login será atômica. Logout remoto deverá invalidar a sessão no servidor e o app deverá reagir a falhas de refresh ou validação.

Alternativa considerada: somente a configuração nativa de sessão única do provedor (insuficiente para mensagem de bloqueio, auditoria e comportamento comercial customizado).

### 5. App móvel e backoffice separados

O app exibirá assinatura, consumo, recursos e suporte. O dashboard será exclusivo dos proprietários, com acesso administrativo separado e auditoria reforçada. Não haverá acesso administrativo baseado apenas em papel informado pelo cliente.

## Risks / Trade-offs

- [Tokens JWT podem continuar válidos até expirar] → usar heartbeat/validação para ações sensíveis e configurar expiração adequada; não prometer revogação instantânea sem validar no servidor.
- [Offline pode parecer sessão abandonada] → aplicar janela de tolerância e distinguir sincronização offline de sessão expirada.
- [Limites incorretos podem bloquear operação pública] → alertas em 80%, período de carência para concluir vistoria e override auditado apenas pelos proprietários.
- [RLS incompleta pode expor dados municipais] → testes negativos obrigatórios com usuários de duas prefeituras e revisão das políticas antes do piloto.
- [Planos mal definidos podem gerar conflito comercial] → marcar quantidades como configuração inicial e exigir aprovação do proprietário antes de publicar.
- [Cobrança em lojas móveis pode exigir fluxo específico] → tratar cobrança como integração posterior, mantendo assinatura manual/importada no piloto.

## Migration Plan

1. Criar tabelas, enums, índices, RLS e funções sem alterar o login atual.
2. Criar organização de migração para contas institucionais existentes e registrar membros com revisão manual.
3. Criar um plano interno de compatibilidade para contas sem assinatura durante o piloto.
4. Adicionar leitura de contexto no `AuthContext` e bloqueios progressivos por recurso.
5. Migrar geração/validação de convites para o vínculo organizacional.
6. Ativar sessão única primeiro em ambiente de teste e depois por organização piloto.
7. Publicar o backoffice e configurar suporte antes de vender novos planos.

Rollback: desativar os entitlements novos por configuração, preservar dados e permitir o fluxo legado apenas para contas de migração. Não remover organizações, vínculos, auditoria ou sessões durante rollback.

## Open Questions

- Quais são os preços, período de teste, excedentes e política de inadimplência?
- A prefeitura administrará agentes somente no app ou haverá um portal municipal futuro?
- ARV é um modelo exclusivo do plano Completo ou pode ser vendido como add-on?
- Quais dados de consumo serão faturáveis: criados, concluídos ou sincronizados?
- Qual será o canal oficial de suporte e o SLA contratual do plano Completo?
