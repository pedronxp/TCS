## Why

A TCS já possui site comercial, console interno e uma base Supabase de planos, assinaturas e organizações, mas clientes individuais e equipes municipais ainda não têm uma experiência Web própria. Criar esses portais agora exige separar rigidamente as superfícies e autorizações, reconciliar o catálogo comercial existente e aprovar antes da implementação uma experiência responsiva derivada do Penpot “TCS — Web Dashboard”.

## What Changes

- Definir três fronteiras Web independentes: site público, portais autenticados de clientes e console interno TCS, com layouts, providers, rotas, sessões e guardas próprios.
- Criar o Portal do Cliente Individual para visão geral, vistorias, agenda, documentos, relatórios, consumo, plano/assinatura, cobrança, suporte e perfil.
- Criar o Portal Municipal com navegação e ações específicas para coordenador, supervisor e agente, preservando o isolamento por `organization_id`.
- Estabelecer a matriz normativa plano × módulo × função × permissão, separando entitlement comercial, papel municipal e escopo do recurso.
- Cobrir loading, vazio, erro/retry, bloqueio de plano, sem permissão, trial, assinatura ativa, inadimplência, carência, cancelamento e recurso preservado somente para leitura.
- Planejar checkout, processamento idempotente de webhook, atualização de assinatura e liberação/revogação automática de módulos.
- Planejar convites municipais vinculados à organização, ao papel, ao limite de assentos, à expiração e ao status da assinatura.
- Reutilizar no Penpot as Foundations, paleta, tipografia Inter, componentes, templates e identidade já aprovados; criar os boards e estados dos novos portais em 1440, 1024, 768 e 390 px.
- Definir um contrato único de identidade e tokens semânticos para Web, Android e iOS, respeitando padrões nativos de navegação e interação.
- Registrar como pré-condição de implementação a reconciliação entre o catálogo vivo do Supabase, os planos comerciais aprovados e a matriz visual aprovada.
- **BREAKING**: nenhuma identidade municipal ou de cliente poderá ser autorizada por `internal_staff`, papel `owner`/`developer`, rotas `/app/*` ou permissões do console TCS.
- Não implementar código, migrations, checkout ou publicação nesta etapa; após aprovação visual, a execução ocorrerá em nova branch e em ondas independentes.

## Capabilities

### New Capabilities

- `web-surface-boundaries`: fronteiras de rotas, autenticação, layouts e autorização entre site público, portais de clientes e console interno TCS.
- `individual-customer-portal`: navegação, páginas, dados, ações e estados do cliente individual.
- `municipal-customer-portal`: experiências de coordenador, supervisor e agente, com escopo organizacional e navegação por função.
- `portal-access-matrix`: contrato plano × módulo × função × permissão, incluindo leitura, criação, gestão, exportação, bloqueios e precedência das decisões.
- `portal-subscription-lifecycle`: checkout, webhook idempotente, trial, ativação, inadimplência, carência, cancelamento e liberação automática de módulos.
- `municipal-portal-invitations`: emissão, aceite, reenvio, revogação e expiração de convites municipais com controle de assentos e assinatura.
- `cross-platform-product-identity`: tokens, componentes, conteúdo e regras de coerência entre Web, Android e iOS.
- `portal-design-governance`: inventário de boards Penpot, estados, breakpoints, acessibilidade, aprovação visual e gate para implementação em ondas.

### Modified Capabilities

Nenhuma. Não existem especificações-base publicadas em `openspec/specs/`; as mudanças relacionadas ainda estão registradas apenas em propostas não arquivadas.

## Impact

- `dashboard/`: futuro roteamento, shells, providers, autenticação, páginas, hooks, manifesto de rotas, regressão visual e separação do console interno.
- `app/`, `components/`, `constants/` e `context/`: contrato futuro de identidade compartilhada e paridade de estados com Android/iOS, sem alterações nesta etapa.
- Supabase Auth, Postgres, RLS, RPCs e Edge Functions: reutilização e endurecimento de organizações, memberships, convites, assinaturas, entitlements, consumo, sessões, documentos, agenda e suporte.
- Nova integração futura com provedor de pagamento, checkout e webhook; o provedor e o modelo fiscal permanecem decisões de implementação posteriores.
- Penpot “TCS — Web Dashboard”: novas páginas, boards, componentes, estados responsivos e registro de aprovação visual.
- Segurança: testes negativos obrigatórios para impedir acesso cruzado entre organizações e qualquer escalada de cliente para `internal_staff` ou `/app/*`.
