## Why

O TCS APP precisa evoluir de um aplicativo operacional para uma plataforma comercializável para dois públicos: usuários individuais e prefeituras/Defesas Civis. Hoje não existe um contrato central para planos, recursos liberados, limites de uso, organizações municipais, convites, sessões e suporte. Sem esse contrato, há risco de vender planos inconsistentes, permitir acesso entre prefeituras ou criar regras diferentes no aplicativo e no painel interno.

Esta mudança cria a base de produto para que cada cliente veja e utilize somente o que sua assinatura permite, mantendo cada agente em uma conta individual e cada prefeitura isolada. Os valores numéricos abaixo serão tratados como configuração inicial revisável, e não como regra fixa de implementação.

## What Changes

- Criar catálogo de planos para usuários individuais e organizações municipais.
- Liberar recursos por plano: modelos de vistoria, modelo ARV, modo treinamento e relatórios.
- Controlar limites por assinatura: agentes, sessões, vistorias, convites e armazenamento.
- Criar organizações para prefeituras, com agentes, coordenadores, supervisores e permissões.
- Vincular cada convite à organização que o criou; impedir que um convite de uma prefeitura crie acesso em outra.
- Aplicar a regra de uma sessão ativa por pessoa, permitindo que pessoas diferentes da mesma prefeitura trabalhem simultaneamente.
- Exibir no aplicativo o plano, os recursos disponíveis, o consumo, os alertas e as opções de upgrade.
- Evoluir o dashboard web para uso exclusivo dos proprietários/desenvolvedores, com gestão de planos, organizações, assinaturas, limites, sessões e suporte.
- Criar suporte por níveis, chamados, prioridades, responsáveis e histórico de atendimento.
- Registrar auditoria de logins, convites, alterações de plano, bloqueios, encerramento de sessões e ações administrativas.
- Garantir isolamento de dados por organização e impedir autorização baseada apenas em município informado pelo cliente.
- **BREAKING**: substituir qualquer uso de município informado pelo aplicativo como fonte de autorização pelo vínculo persistido entre usuário e organização.

## Capabilities

### New Capabilities

- `subscription-plans`: catálogo de planos individuais e municipais, recursos, limites, status e configuração comercial.
- `organization-access`: organizações, membros, funções, convites vinculados e isolamento entre prefeituras.
- `session-control`: uma sessão ativa por pessoa, heartbeat, timeout, logout e encerramento remoto.
- `usage-entitlements`: contadores de vistorias, convites, usuários, armazenamento e autorização por recurso.
- `mobile-subscription-experience`: exibição de assinatura, consumo, recursos bloqueados, alertas e upgrade dentro do app iOS/Android.
- `owner-admin-console`: administração interna de clientes, planos, organizações, assinaturas, permissões, auditoria e suporte.
- `support-operations`: chamados, níveis de atendimento, prioridades, metas de resposta, implantação municipal e histórico.

### Modified Capabilities

Nenhuma especificação existente em `openspec/specs/` foi encontrada para modificar. As integrações com autenticação, usuários, treinamento, tokens e dashboard serão detalhadas no design e nas novas especificações.

## Impact

- Aplicativo Expo/React Native em `app/`, `context/` e `utils/`, especialmente autenticação, login, carregamento de perfil, criação de vistorias, geração de convites e treinamento.
- Dashboard React/Vite em `dashboard/`, que será direcionado ao uso interno dos proprietários.
- Supabase Auth, tabelas públicas, funções RPC, políticas RLS, migrações e possíveis Edge Functions.
- Modelo de dados: organizações, membros, planos, recursos, assinaturas, consumo, sessões, convites, chamados e auditoria.
- Fluxos comerciais e de suporte, incluindo trial, assinatura ativa, vencida, cancelada, carência, upgrade e bloqueio de novas operações.
- Testes de autorização, concorrência, isolamento entre prefeituras, limites, sessões e sincronização offline.
- Nenhuma implementação de cobrança ou alteração do aplicativo deve ser iniciada somente com os limites exemplificados neste documento; preços, política de excedentes, período de teste e regras de cobrança precisam ser aprovados pelos proprietários antes da execução.
